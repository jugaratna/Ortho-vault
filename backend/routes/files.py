"""File upload/download routes."""
import uuid
import requests
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from config import APP_NAME
from deps import current_user
from storage import put_object_sync, get_object_sync

router = APIRouter()


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


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(current_user)):
    if user.get("role") == "viewer":
        raise HTTPException(status_code=403, detail="Read-only user")
    contents = await file.read()
    if len(contents) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 100 MiB limit")
    original_name = file.filename or "file"
    ext = ""
    if "." in original_name:
        raw = original_name.rsplit(".", 1)[1].lower()
        cleaned = "".join(c for c in raw if c.isalnum())[:8]
        if cleaned:
            ext = "." + cleaned
    obj_uuid = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/patients/{user['user_id']}/{obj_uuid}{ext}"
    mime = file.content_type or "application/octet-stream"
    try:
        result = await run_in_threadpool(put_object_sync, path, contents, mime)
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


@router.get("/files/{path:path}")
async def get_file(path: str, user=Depends(current_user)):
    upload_prefix = f"{APP_NAME}/uploads/patients/"
    if ".." in path or path.startswith("/") or "\\" in path or "%2e" in path.lower() or not path.startswith(upload_prefix):
        raise HTTPException(status_code=400, detail="Invalid path")
    if user.get("role") != "admin":
        expected_prefix = f"{upload_prefix}{user['user_id']}/"
        if not path.startswith(expected_prefix):
            raise HTTPException(status_code=403, detail="Not your file")
    try:
        content, ctype = await run_in_threadpool(get_object_sync, path)
    except HTTPException:
        raise
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        raise HTTPException(status_code=code, detail="Download failed")
    return Response(content=content, media_type=ctype)
