"""Activity log helper — write-only from route modules, read via /api/activity."""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from db import db
from config import logger


async def log_activity(
    *,
    actor: Dict[str, Any],
    action: str,
    entity_type: str = "patient",
    entity_id: Optional[str] = None,
    entity_name: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    """Fire-and-forget audit event.

    action ∈ {"create","update","delete","share","unshare","media_added"}
    Never raises — failing to log must NEVER break the calling request.
    """
    try:
        doc = {
            "id": uuid.uuid4().hex,
            "actor_id": actor.get("user_id", ""),
            "actor_name": actor.get("name") or actor.get("email") or "",
            "actor_email": actor.get("email", ""),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id or "",
            "entity_name": entity_name or "",
            "meta": meta or {},
            "at": datetime.now(timezone.utc),
        }
        await db.activity_log.insert_one(doc)
    except Exception as e:
        logger.warning(f"log_activity failed: {e}")
