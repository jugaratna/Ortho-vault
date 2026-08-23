"""Patient CRUD + sharing + activity logging."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from db import db
from deps import current_user
from models import Patient, PatientUpsert, ShareEntry, ShareIn
from activity import log_activity

router = APIRouter(prefix="/patients")


# ---------------- Access helpers ----------------
def _shared_uids(doc: dict) -> List[str]:
    return [s.get("user_id", "") for s in (doc.get("shared_with") or [])]


def _can_view(doc: dict, user: dict) -> bool:
    if user.get("role") == "admin":
        return True
    if doc.get("owner_id") == user["user_id"]:
        return True
    return user["user_id"] in _shared_uids(doc)


def _can_edit(doc: dict, user: dict) -> bool:
    if user.get("role") == "viewer":
        return False
    if user.get("role") == "admin":
        return True
    if doc.get("owner_id") == user["user_id"]:
        return True
    for s in (doc.get("shared_with") or []):
        if s.get("user_id") == user["user_id"] and s.get("scope") == "edit":
            return True
    return False


def _is_owner(doc: dict, user: dict) -> bool:
    return doc.get("owner_id") == user["user_id"] or user.get("role") == "admin"


def _media_count(doc_or_payload) -> int:
    if isinstance(doc_or_payload, dict):
        return len(doc_or_payload.get("pre_op") or []) + len(doc_or_payload.get("post_op") or []) + len(doc_or_payload.get("videos") or [])
    # Pydantic model
    return len(doc_or_payload.pre_op) + len(doc_or_payload.post_op) + len(doc_or_payload.videos)


# ---------------- Routes ----------------
@router.get("", response_model=List[Patient])
async def list_patients(user=Depends(current_user)):
    if user.get("role") == "admin":
        q = {}
    else:
        q = {"$or": [
            {"owner_id": user["user_id"]},
            {"shared_with.user_id": user["user_id"]},
        ]}
    docs = await db.patients.find(q, {"_id": 0}).to_list(2000)
    return [Patient(**d) for d in docs]


@router.get("/{pid}", response_model=Patient)
async def get_patient(pid: str, user=Depends(current_user)):
    doc = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not _can_view(doc, user):
        raise HTTPException(status_code=403, detail="Not your patient")
    return Patient(**doc)


@router.post("", response_model=Patient)
async def upsert_patient(payload: PatientUpsert, user=Depends(current_user)):
    if user.get("role") == "viewer":
        raise HTTPException(status_code=403, detail="Read-only user")
    now = datetime.now(timezone.utc).isoformat()

    if payload.id:
        existing = await db.patients.find_one({"id": payload.id}, {"_id": 0})
        if existing:
            if not _can_edit(existing, user):
                raise HTTPException(status_code=403, detail="Not your patient")
            data = payload.model_dump()
            data["created_at"] = existing.get("created_at", now)
            data["updated_at"] = now
            data["owner_id"] = existing.get("owner_id") or user["user_id"]
            # Preserve existing shares — never overwrite from client payload
            data["shared_with"] = existing.get("shared_with") or []
            # Detect newly added media (log as media_added)
            new_media = max(0, _media_count(data) - _media_count(existing))
            await db.patients.update_one({"id": payload.id}, {"$set": data})
            await log_activity(actor=user, action="update", entity_id=payload.id, entity_name=data.get("name", ""))
            if new_media > 0:
                await log_activity(
                    actor=user, action="media_added",
                    entity_id=payload.id, entity_name=data.get("name", ""),
                    meta={"count": new_media},
                )
            return Patient(**data)

    # Insert new
    pid = payload.id or str(uuid.uuid4())
    data = payload.model_dump()
    data["id"] = pid
    data["created_at"] = now
    data["updated_at"] = now
    data["owner_id"] = user["user_id"]
    data["shared_with"] = []
    await db.patients.insert_one(dict(data))
    await log_activity(actor=user, action="create", entity_id=pid, entity_name=data.get("name", ""))
    if _media_count(data) > 0:
        await log_activity(
            actor=user, action="media_added",
            entity_id=pid, entity_name=data.get("name", ""),
            meta={"count": _media_count(data)},
        )
    return Patient(**data)


@router.delete("/{pid}")
async def delete_patient(pid: str, user=Depends(current_user)):
    doc = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Patient not found")
    # Only owner (or admin) can delete
    if not _is_owner(doc, user):
        raise HTTPException(status_code=403, detail="Only the owner can delete")
    if user.get("role") == "viewer":
        raise HTTPException(status_code=403, detail="Read-only user")
    await db.patients.delete_one({"id": pid})
    await log_activity(actor=user, action="delete", entity_id=pid, entity_name=doc.get("name", ""))
    return {"ok": True}


# ---------------- Sharing ----------------
@router.post("/{pid}/share")
async def share_patient(pid: str, payload: ShareIn, user=Depends(current_user)):
    if payload.scope not in ("read", "edit"):
        raise HTTPException(status_code=400, detail="Invalid scope")
    doc = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not _is_owner(doc, user):
        raise HTTPException(status_code=403, detail="Only the owner can share")
    if payload.user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Can't share with yourself")
    target = await db.users.find_one(
        {"user_id": payload.user_id, "role": {"$in": ["admin", "editor"]}},
        {"_id": 0, "user_id": 1, "email": 1, "name": 1},
    )
    if not target:
        raise HTTPException(status_code=404, detail="Colleague not found or not eligible")

    entry = {
        "user_id": target["user_id"],
        "scope": payload.scope,
        "email": target.get("email", ""),
        "name": target.get("name", ""),
        "shared_at": datetime.now(timezone.utc).isoformat(),
    }

    # Remove any prior entry for that user, then push the new one
    await db.patients.update_one({"id": pid}, {"$pull": {"shared_with": {"user_id": target["user_id"]}}})
    await db.patients.update_one({"id": pid}, {"$push": {"shared_with": entry}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    await log_activity(
        actor=user, action="share",
        entity_id=pid, entity_name=doc.get("name", ""),
        meta={"target_user_id": target["user_id"], "target_email": target.get("email", ""), "scope": payload.scope},
    )
    return {"ok": True, "entry": entry}


@router.delete("/{pid}/share/{user_id}")
async def unshare_patient(pid: str, user_id: str, user=Depends(current_user)):
    doc = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not _is_owner(doc, user):
        raise HTTPException(status_code=403, detail="Only the owner can unshare")
    # Look up target email/name for the activity log (best-effort)
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1, "name": 1}) or {}
    await db.patients.update_one({"id": pid}, {"$pull": {"shared_with": {"user_id": user_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    await log_activity(
        actor=user, action="unshare",
        entity_id=pid, entity_name=doc.get("name", ""),
        meta={"target_user_id": user_id, "target_email": target.get("email", "")},
    )
    return {"ok": True}
