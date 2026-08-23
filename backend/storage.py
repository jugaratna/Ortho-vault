"""Emergent Object Storage helpers (sync — call via run_in_threadpool)."""
from typing import Optional
import requests
from fastapi import HTTPException
from config import STORAGE_URL, EMERGENT_KEY

_storage_key: Optional[str] = None


def _init_storage_sync() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init",
                         json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _reset_storage_key():
    global _storage_key
    _storage_key = None


def put_object_sync(path: str, data: bytes, content_type: str) -> dict:
    key = _init_storage_sync()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=180)
    if resp.status_code == 503:
        _reset_storage_key()
        key = _init_storage_sync()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=180)
    resp.raise_for_status()
    return resp.json()


def get_object_sync(path: str):
    key = _init_storage_sync()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        _reset_storage_key()
        key = _init_storage_sync()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 500:
        raise HTTPException(status_code=404, detail="File not found")
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def init_storage_startup():
    """Called on FastAPI startup. Safe to no-op if it fails."""
    return _init_storage_sync()
