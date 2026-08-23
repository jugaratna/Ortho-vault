from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Query, Depends
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import uuid
import requests
import jwt
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent Object Storage
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "orthovault"
storage_key: Optional[str] = None

app = FastAPI()
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

# Auth config
JWT_SECRET = os.environ.get("JWT_SECRET_KEY", "orthovault-dev-secret-change-me")
JWT_ALGO = "HS256"
TOKEN_MINUTES = 60 * 24 * 7  # 7 days

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def _init_storage_sync():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init",
                         json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def _put_object_sync(path: str, data: bytes, content_type: str) -> dict:
    key = _init_storage_sync()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=180)
    if resp.status_code == 503:
        # stale key, reset & retry once
        global storage_key
        storage_key = None
        key = _init_storage_sync()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=180)
    resp.raise_for_status()
    return resp.json()


def _get_object_sync(path: str):
    key = _init_storage_sync()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        global storage_key
        storage_key = None
        key = _init_storage_sync()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 500:
        raise HTTPException(status_code=404, detail="File not found")
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- Models ----------
class MediaFile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    kind: str  # "image" | "pdf" | "doc" | "video" | "dicom" | "other"
    mime: str
    size: int = 0
    storage_path: str  # remote object path
    section: str  # "pre_op" | "post_op" | "video"
    uploaded_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Patient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    age: int
    sex: str  # Male | Female | Other
    mobile: str
    country_code: str = "+91"
    diagnosis: str = ""
    history: str = ""
    date_of_surgery: Optional[str] = None  # ISO YYYY-MM-DD
    followup_days: Optional[int] = None  # per-patient override (null = use global)
    operative_note: str = ""
    discharge_note: str = ""
    result: str = ""
    pre_op: List[MediaFile] = []
    post_op: List[MediaFile] = []
    videos: List[MediaFile] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PatientUpsert(BaseModel):
    id: Optional[str] = None
    name: str
    age: int
    sex: str
    mobile: str
    country_code: str = "+91"
    diagnosis: str = ""
    history: str = ""
    date_of_surgery: Optional[str] = None
    followup_days: Optional[int] = None
    operative_note: str = ""
    discharge_note: str = ""
    result: str = ""
    pre_op: List[MediaFile] = []
    post_op: List[MediaFile] = []
    videos: List[MediaFile] = []


# ---------- Auth Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    name: str = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    name: str = ""
    role: str = "editor"  # admin | editor | viewer


class UserOut(BaseModel):
    id: str
    email: str
    name: str = ""
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def _hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8")[:72], bcrypt.gensalt(rounds=12)).decode()


def _verify_pw(pw: str, stored: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8")[:72], stored.encode())
    except Exception:
        return False


def _make_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=TOKEN_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles):
    async def dep(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "OrthoVault API", "status": "ok"}


@api_router.get("/patients", response_model=List[Patient])
async def list_patients():
    docs = await db.patients.find({}, {"_id": 0}).to_list(2000)
    return [Patient(**d) for d in docs]


@api_router.get("/patients/{pid}", response_model=Patient)
async def get_patient(pid: str):
    doc = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Patient not found")
    return Patient(**doc)


@api_router.post("/patients", response_model=Patient)
async def upsert_patient(payload: PatientUpsert):
    now = datetime.now(timezone.utc).isoformat()
    if payload.id:
        existing = await db.patients.find_one({"id": payload.id}, {"_id": 0})
        if existing:
            data = payload.model_dump()
            data["created_at"] = existing.get("created_at", now)
            data["updated_at"] = now
            await db.patients.update_one({"id": payload.id}, {"$set": data})
            return Patient(**data)
    # create new
    pid = payload.id or str(uuid.uuid4())
    data = payload.model_dump()
    data["id"] = pid
    data["created_at"] = now
    data["updated_at"] = now
    await db.patients.insert_one(dict(data))
    return Patient(**data)


@api_router.delete("/patients/{pid}")
async def delete_patient(pid: str):
    res = await db.patients.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"ok": True}


def _guess_kind(mime: str, name: str) -> str:
    mime = (mime or "").lower()
    n = (name or "").lower()
    if mime.startswith("image/") or n.endswith((".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")):
        return "image"
    if mime.startswith("video/") or n.endswith((".mp4", ".mov", ".m4v", ".webm")):
        return "video"
    if "pdf" in mime or n.endswith(".pdf"):
        return "pdf"
    if "word" in mime or n.endswith((".doc", ".docx")):
        return "doc"
    if n.endswith((".dcm", ".dicom")) or "dicom" in mime:
        return "dicom"
    return "other"


@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    original_name = file.filename or "file"
    ext = ""
    if "." in original_name:
        ext = "." + original_name.rsplit(".", 1)[1].lower()
    obj_uuid = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/patients/{obj_uuid}{ext}"
    mime = file.content_type or "application/octet-stream"
    try:
        result = await run_in_threadpool(_put_object_sync, path, contents, mime)
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        detail = "Upload failed"
        if code == 402:
            detail = "Storage quota exceeded"
        raise HTTPException(status_code=code, detail=detail)
    return {
        "storage_path": result.get("path", path),
        "size": result.get("size", len(contents)),
        "name": original_name,
        "mime": mime,
        "kind": _guess_kind(mime, original_name),
    }


@api_router.get("/files/{path:path}")
async def get_file(path: str):
    try:
        content, ctype = await run_in_threadpool(_get_object_sync, path)
    except HTTPException:
        raise
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        raise HTTPException(status_code=code, detail="Download failed")
    return Response(content=content, media_type=ctype)


@api_router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe short audio recording (voice notes) via Whisper."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio must be 25 MiB or smaller")

    original = file.filename or "recording.m4a"
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else "m4a"
    # Whisper supports: mp3 mp4 mpeg mpga m4a wav webm
    if ext not in {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}:
        ext = "m4a"

    stt = OpenAISpeechToText(api_key=EMERGENT_KEY)
    buf = io.BytesIO(data)
    buf.name = f"voice.{ext}"
    try:
        result = await stt.transcribe(file=buf, model="whisper-1", response_format="text")
        text = str(result).strip() if not hasattr(result, "text") else str(result.text).strip()
    except Exception as e:
        logger.warning(f"Transcription failed: {e}")
        raise HTTPException(status_code=502, detail="Transcription failed")

    return {"text": text}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    try:
        await run_in_threadpool(_init_storage_sync)
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Object storage init failed at startup: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
