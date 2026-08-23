"""Patient CRUD routes."""
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from db import db
from deps import current_user
from models import Patient, PatientUpsert

router = APIRouter(prefix="/patients")


@router.get("", response_model=List[Patient])
async def list_patients(user=Depends(current_user)):
    q = {} if user.get("role") == "admin" else {"owner_id": user["user_id"]}
    docs = await db.patients.find(q, {"_id": 0}).to_list(2000)
    return [Patient(**d) for d in docs]


@router.get("/{pid}", response_model=Patient)
async def get_patient(pid: str, user=Depends(current_user)):
    doc = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Patient not found")
    if user.get("role") != "admin" and doc.get("owner_id") and doc["owner_id"] != user["user_id"]:
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


@router.delete("/{pid}")
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
