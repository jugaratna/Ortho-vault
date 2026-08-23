from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Query, Depends, Request, Header
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import uuid
import requests
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText
from emergentintegrations.llm.chat import LlmChat, UserMessage


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

# Emergent auth
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_TTL_DAYS = 7

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
class SessionExchange(BaseModel):
    session_id: str


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str = ""
    picture: str = ""
    role: str = "editor"
    last_active: Optional[str] = None


class SessionOut(BaseModel):
    session_token: str
    user: UserOut


async def current_user(authorization: Optional[str] = Header(None), token: Optional[str] = Query(None)) -> dict:
    tok: Optional[str] = None
    if authorization and authorization.lower().startswith("bearer "):
        tok = authorization.split(None, 1)[1].strip()
    elif token:
        tok = token.strip()
    if not tok:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    session = await db.user_sessions.find_one({"session_token": tok}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = session.get("expires_at")
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # bump last_active (fire-and-forget)
    try:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_active": datetime.now(timezone.utc)}})
    except Exception:
        pass
    return user


def require_admin(user=Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ---------- Auth Routes ----------
@api_router.post("/auth/session", response_model=SessionOut)
async def auth_session(payload: SessionExchange):
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": payload.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session_id")
    data = r.json()
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=401, detail="Auth response missing email")
    name = data.get("name") or ""
    picture = data.get("picture") or ""
    session_token = data.get("session_token")
    if not session_token:
        raise HTTPException(status_code=401, detail="Auth response missing session_token")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=SESSION_TTL_DAYS)

    # Upsert user by email
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user = existing
        # Update profile fields opportunistically
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"name": name or user.get("name", ""), "picture": picture or user.get("picture", "")}})
    else:
        # First-ever user becomes admin
        total = await db.users.count_documents({})
        role = "admin" if total == 0 else "editor"
        # Honor pending invite (case-insensitive email match)
        invite = await db.invites.find_one({"email": email})
        if invite and invite.get("role") in ("admin", "editor", "viewer"):
            role = invite["role"]
            await db.invites.delete_one({"email": email})
        user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": name,
            "picture": picture,
            "role": role,
            "created_at": now,
            "last_active": now,
        }
        await db.users.insert_one(dict(user))

    # Store session
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "created_at": now,
        "expires_at": expires_at,
    })

    return SessionOut(
        session_token=session_token,
        user=UserOut(
            user_id=user["user_id"],
            email=user["email"],
            name=user.get("name", ""),
            picture=user.get("picture", ""),
            role=user.get("role", "editor"),
        ),
    )


@api_router.get("/auth/me", response_model=UserOut)
async def auth_me(user=Depends(current_user)):
    return UserOut(
        user_id=user["user_id"],
        email=user["email"],
        name=user.get("name", ""),
        picture=user.get("picture", ""),
        role=user.get("role", "editor"),
    )


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(None, 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api_router.get("/auth/users", response_model=List[UserOut])
async def list_users(_=Depends(require_admin)):
    docs = await db.users.find({}, {"_id": 0}).to_list(500)
    out = []
    for d in docs:
        la = d.get("last_active")
        if isinstance(la, datetime):
            la = la.isoformat()
        out.append(UserOut(
            user_id=d.get("user_id", ""),
            email=d.get("email", ""),
            name=d.get("name", ""),
            picture=d.get("picture", ""),
            role=d.get("role", "editor"),
            last_active=la if isinstance(la, str) else None,
        ))
    return out


class InviteIn(BaseModel):
    email: str
    role: str = "editor"


class InviteOut(BaseModel):
    email: str
    role: str
    invited_at: Optional[str] = None


@api_router.get("/auth/invites", response_model=List[InviteOut])
async def list_invites(_=Depends(require_admin)):
    docs = await db.invites.find({}, {"_id": 0}).to_list(500)
    out = []
    for d in docs:
        ia = d.get("invited_at")
        if isinstance(ia, datetime):
            ia = ia.isoformat()
        out.append(InviteOut(email=d.get("email", ""), role=d.get("role", "editor"), invited_at=ia if isinstance(ia, str) else None))
    return out


@api_router.post("/auth/invites", response_model=InviteOut)
async def create_invite(payload: InviteIn, _=Depends(require_admin)):
    if payload.role not in ("admin", "editor", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email")
    # If user already exists, just change their role instead of storing an invite
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        await db.users.update_one({"user_id": existing["user_id"]}, {"$set": {"role": payload.role}})
        return InviteOut(email=email, role=payload.role, invited_at=None)
    now = datetime.now(timezone.utc)
    await db.invites.update_one({"email": email}, {"$set": {"email": email, "role": payload.role, "invited_at": now}}, upsert=True)
    return InviteOut(email=email, role=payload.role, invited_at=now.isoformat())


@api_router.delete("/auth/invites/{email}")
async def delete_invite(email: str, _=Depends(require_admin)):
    email = email.strip().lower()
    await db.invites.delete_one({"email": email})
    return {"ok": True}


class RoleUpdate(BaseModel):
    role: str


@api_router.patch("/auth/users/{user_id}")
async def update_user_role(user_id: str, payload: RoleUpdate, _=Depends(require_admin)):
    if payload.role not in ("admin", "editor", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    res = await db.users.update_one({"user_id": user_id}, {"$set": {"role": payload.role}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "OrthoVault API", "status": "ok"}


@api_router.get("/patients", response_model=List[Patient])
async def list_patients(user=Depends(current_user)):
    q = {} if user.get("role") == "admin" else {"owner_id": user["user_id"]}
    docs = await db.patients.find(q, {"_id": 0}).to_list(2000)
    return [Patient(**d) for d in docs]


@api_router.get("/patients/{pid}", response_model=Patient)
async def get_patient(pid: str, user=Depends(current_user)):
    doc = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Patient not found")
    if user.get("role") != "admin" and doc.get("owner_id") and doc["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your patient")
    return Patient(**doc)


@api_router.post("/patients", response_model=Patient)
async def upsert_patient(payload: PatientUpsert, user=Depends(current_user)):
    if user.get("role") == "viewer":
        raise HTTPException(status_code=403, detail="Read-only user")
    now = datetime.now(timezone.utc).isoformat()
    if payload.id:
        existing = await db.patients.find_one({"id": payload.id}, {"_id": 0})
        if existing:
            if user.get("role") != "admin" and existing.get("owner_id") and existing["owner_id"] != user["user_id"]:
                raise HTTPException(status_code=403, detail="Not your patient")
            data = payload.model_dump()
            data["created_at"] = existing.get("created_at", now)
            data["updated_at"] = now
            data["owner_id"] = existing.get("owner_id") or user["user_id"]
            await db.patients.update_one({"id": payload.id}, {"$set": data})
            return Patient(**data)
    pid = payload.id or str(uuid.uuid4())
    data = payload.model_dump()
    data["id"] = pid
    data["created_at"] = now
    data["updated_at"] = now
    data["owner_id"] = user["user_id"]
    await db.patients.insert_one(dict(data))
    return Patient(**data)


@api_router.delete("/patients/{pid}")
async def delete_patient(pid: str, user=Depends(current_user)):
    doc = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Patient not found")
    if user.get("role") != "admin" and doc.get("owner_id") and doc["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your patient")
    if user.get("role") == "viewer":
        raise HTTPException(status_code=403, detail="Read-only user")
    await db.patients.delete_one({"id": pid})
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
async def upload_file(file: UploadFile = File(...), user=Depends(current_user)):
    if user.get("role") == "viewer":
        raise HTTPException(status_code=403, detail="Read-only user")
    contents = await file.read()
    if len(contents) > 100 * 1024 * 1024:  # 100 MiB cap
        raise HTTPException(status_code=413, detail="File exceeds 100 MiB limit")
    original_name = file.filename or "file"
    ext = ""
    if "." in original_name:
        raw = original_name.rsplit(".", 1)[1].lower()
        # only keep alnum extensions of reasonable length
        cleaned = "".join(c for c in raw if c.isalnum())[:8]
        if cleaned:
            ext = "." + cleaned
    obj_uuid = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/patients/{user['user_id']}/{obj_uuid}{ext}"
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
async def get_file(path: str, user=Depends(current_user)):
    # Path sanity: must live under our uploads prefix and not traverse
    upload_prefix = f"{APP_NAME}/uploads/patients/"
    if ".." in path or path.startswith("/") or "\\" in path or "%2e" in path.lower() or not path.startswith(upload_prefix):
        raise HTTPException(status_code=400, detail="Invalid path")
    # Ownership: non-admins may only read files that belong to them (path segment matches their user_id)
    if user.get("role") != "admin":
        expected_prefix = f"{upload_prefix}{user['user_id']}/"
        if not path.startswith(expected_prefix):
            raise HTTPException(status_code=403, detail="Not your file")
    try:
        content, ctype = await run_in_threadpool(_get_object_sync, path)
    except HTTPException:
        raise
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        raise HTTPException(status_code=code, detail="Download failed")
    return Response(content=content, media_type=ctype)


@api_router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), user=Depends(current_user)):
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


class DraftDischargeIn(BaseModel):
    name: str = ""
    age: int = 0
    sex: str = ""
    diagnosis: str = ""
    date_of_surgery: Optional[str] = None
    operative_note: str = ""
    result: str = ""


@api_router.post("/ai/draft-discharge")
async def draft_discharge(payload: DraftDischargeIn, user=Depends(current_user)):
    if not EMERGENT_KEY:
        raise HTTPException(status_code=500, detail="LLM key missing")
    if not (payload.operative_note.strip() or payload.result.strip()):
        raise HTTPException(status_code=400, detail="Need an operative note or result to draft from")

    system = (
        "You are a senior orthopedic surgeon writing a concise, structured DISCHARGE SUMMARY "
        "for a hospital record. Use clear clinical headings in ALL CAPS on their own line. "
        "Return plain text only (no markdown). Keep it factual — do not invent details not in the input. "
        "If a field cannot be inferred, write '__' as a placeholder for the surgeon to fill in. "
        "Include sections: Admission/Surgery/Discharge dates, Pre-op Diagnosis, Procedure Performed & Implants, "
        "Hospital Course, ROM at Discharge, Wound Status, Weight Bearing, Physiotherapy Protocol, "
        "Discharge Medications (antibiotic, analgesic, DVT prophylaxis), Follow-up Plan, Red-flag Signs Advised, "
        "and a Signature line."
    )

    context = (
        f"PATIENT: {payload.name}, {payload.age}y {payload.sex}\n"
        f"DIAGNOSIS: {payload.diagnosis or '—'}\n"
        f"DATE OF SURGERY: {payload.date_of_surgery or '—'}\n\n"
        f"OPERATIVE NOTE:\n{payload.operative_note or '(not recorded)'}\n\n"
        f"OUTCOME / RESULT:\n{payload.result or '(not recorded)'}\n\n"
        f"Draft the discharge summary now."
    )

    try:
        chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"discharge-{uuid.uuid4()}", system_message=system)
        chat = chat.with_model("openai", "gpt-4o-mini")
        draft = await chat.send_message(UserMessage(text=context))
    except Exception as e:
        logger.warning(f"Discharge draft failed: {e}")
        raise HTTPException(status_code=502, detail="AI draft failed")

    return {"draft": (draft or "").strip()}


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
    # Ensure indexes for auth
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        logger.info("Auth indexes ensured")
    except Exception as e:
        logger.warning(f"Index creation failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
