"""Auth dependencies: current_user, require_admin."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import Depends, HTTPException, Header, Query
from db import db


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
    # bump last_active (best-effort)
    try:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"last_active": datetime.now(timezone.utc)}},
        )
    except Exception:
        pass
    return user


def require_admin(user=Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user
