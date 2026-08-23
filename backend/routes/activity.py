"""Admin-only activity feed."""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query

from db import db
from deps import require_admin
from models import ActivityOut

router = APIRouter(prefix="/activity")


@router.get("", response_model=List[ActivityOut])
async def list_activity(
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    _=Depends(require_admin),
):
    q: dict = {}
    if action:
        q["action"] = action
    docs = await db.activity_log.find(q, {"_id": 0}).sort("at", -1).to_list(limit)
    out: List[ActivityOut] = []
    for d in docs:
        at = d.get("at")
        if isinstance(at, datetime):
            at = at.isoformat()
        out.append(ActivityOut(
            id=d.get("id", ""),
            actor_id=d.get("actor_id", ""),
            actor_name=d.get("actor_name", ""),
            action=d.get("action", ""),
            entity_type=d.get("entity_type", "patient"),
            entity_id=d.get("entity_id", ""),
            entity_name=d.get("entity_name", ""),
            meta=d.get("meta") or {},
            at=at if isinstance(at, str) else "",
        ))
    return out
