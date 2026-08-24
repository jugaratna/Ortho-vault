"""Auth, users, and invites routes."""
import uuid
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, Request

from config import EMERGENT_AUTH_URL, SESSION_TTL_DAYS, logger
from db import db
from deps import current_user, require_admin
from models import (
    SessionExchange, SessionOut, UserOut,
    InviteIn, InviteOut, BulkInviteIn, RoleUpdate, ColleagueOut,
)
from emailing import build_invite_email, send_email, _sanitize_url_for_email

router = APIRouter(prefix="/auth")

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _base_sign_in_url(request: Request, invite_email: str = "", invite_role: str = "") -> Optional[str]:
    """Derive a safe absolute https URL to /login.

    Precedence:
      1. Browser-sent `Origin` / `Referer` header (web)
      2. Client-sent `X-App-Origin` header (mobile — React Native has no Origin)
      3. Backend env `APP_PUBLIC_URL`
    Optionally appends `?invite=<email>&role=<role>` for a personalized deep-link welcome.
    """
    import os as _os
    from urllib.parse import urlparse, urlencode
    candidates = [
        request.headers.get("origin"),
        request.headers.get("referer"),
        request.headers.get("x-app-origin"),
        _os.environ.get("APP_PUBLIC_URL"),
    ]
    for raw in candidates:
        if not raw:
            continue
        try:
            p = urlparse(raw.strip())
        except Exception:
            continue
        if not p.scheme or not p.hostname:
            continue
        base = f"{p.scheme}://{p.hostname}"
        if p.port and p.port not in (80, 443):
            base += f":{p.port}"
        candidate = f"{base}/login"
        if invite_email:
            qs = urlencode({"invite": invite_email, "role": invite_role or "editor"})
            candidate = f"{candidate}?{qs}"
        safe = _sanitize_url_for_email(candidate)
        if safe:
            return safe
    return None


# ---------------- Session exchange ----------------
@router.post("/session", response_model=SessionOut)
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

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user = existing
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"name": name or user.get("name", ""), "picture": picture or user.get("picture", "")}},
        )
    else:
        total = await db.users.count_documents({})
        role = "admin" if total == 0 else "editor"
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


@router.get("/me", response_model=UserOut)
async def auth_me(user=Depends(current_user)):
    return UserOut(
        user_id=user["user_id"],
        email=user["email"],
        name=user.get("name", ""),
        picture=user.get("picture", ""),
        role=user.get("role", "editor"),
    )


@router.post("/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(None, 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------- Users ----------------
@router.get("/users", response_model=List[UserOut])
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


@router.patch("/users/{user_id}")
async def update_user_role(user_id: str, payload: RoleUpdate, _=Depends(require_admin)):
    if payload.role not in ("admin", "editor", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    res = await db.users.update_one({"user_id": user_id}, {"$set": {"role": payload.role}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@router.get("/colleagues", response_model=List[ColleagueOut])
async def list_colleagues(user=Depends(current_user)):
    """Non-viewer team members visible to any authenticated user (for sharing UI).

    Returns everyone who can be a share recipient (admin/editor), excluding the caller.
    """
    docs = await db.users.find(
        {"role": {"$in": ["admin", "editor"]}, "user_id": {"$ne": user["user_id"]}},
        {"_id": 0, "user_id": 1, "email": 1, "name": 1, "role": 1},
    ).to_list(500)
    return [ColleagueOut(**d) for d in docs]


# ---------------- Invites ----------------
@router.get("/invites", response_model=List[InviteOut])
async def list_invites(_=Depends(require_admin)):
    docs = await db.invites.find({}, {"_id": 0}).to_list(500)
    out = []
    for d in docs:
        ia = d.get("invited_at")
        if isinstance(ia, datetime):
            ia = ia.isoformat()
        out.append(InviteOut(
            email=d.get("email", ""),
            role=d.get("role", "editor"),
            invited_at=ia if isinstance(ia, str) else None,
        ))
    return out


async def _create_or_update_invite(email: str, role: str) -> tuple[dict, bool]:
    """Returns (invite_or_user_doc, is_existing_user).

    If a user already exists, updates their role and returns their doc.
    Otherwise creates/updates an invite record.
    """
    now = datetime.now(timezone.utc)
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        await db.users.update_one({"user_id": existing["user_id"]}, {"$set": {"role": role}})
        return ({"email": email, "role": role, "invited_at": None}, True)
    await db.invites.update_one(
        {"email": email},
        {"$set": {"email": email, "role": role, "invited_at": now}},
        upsert=True,
    )
    return ({"email": email, "role": role, "invited_at": now.isoformat()}, False)


async def _send_invite_email_safe(*, invitee_email: str, role: str, invited_by_name: str, sign_in_url: Optional[str]) -> bool:
    """Best-effort. Returns True on send success, False on any issue (never raises)."""
    try:
        # If we don't have a safe URL, fall back to a text-only ask (no link) — but keep template intact.
        link = sign_in_url or ""
        # If link is empty or unsafe, use a generic https https anchor to satisfy the gate: the
        # sender address is app's own; we simply omit the button. Easiest: skip if no link.
        if not link:
            logger.info("Skipping invite email — no safe sign-in URL from request Origin")
            return False
        subject, html = build_invite_email(
            invitee_email=invitee_email,
            role=role,
            invited_by_name=invited_by_name,
            sign_in_url=link,
        )
        await send_email(to=invitee_email, subject=subject, html=html)
        return True
    except Exception as e:
        logger.warning(f"Invite email failed for {invitee_email}: {e}")
        return False


@router.post("/invites", response_model=InviteOut)
async def create_invite(payload: InviteIn, request: Request, user=Depends(require_admin)):
    if payload.role not in ("admin", "editor", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    email = (payload.email or "").strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email")

    invite, is_user = await _create_or_update_invite(email, payload.role)
    sent = False
    if not is_user:
        sign_in_url = _base_sign_in_url(request, invite_email=email, invite_role=payload.role)
        sent = await _send_invite_email_safe(
            invitee_email=email,
            role=payload.role,
            invited_by_name=user.get("name") or user.get("email") or "",
            sign_in_url=sign_in_url,
        )
    return InviteOut(email=invite["email"], role=invite["role"], invited_at=invite.get("invited_at"), emailed=sent)


@router.post("/invites/bulk")
async def bulk_invite(payload: BulkInviteIn, request: Request, user=Depends(require_admin)):
    if payload.role not in ("admin", "editor", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    if not payload.emails:
        raise HTTPException(status_code=400, detail="No emails provided")
    if len(payload.emails) > 100:
        raise HTTPException(status_code=400, detail="Bulk invite limited to 100 addresses per request")

    sign_in_url = _base_sign_in_url(request)
    inviter_name = user.get("name") or user.get("email") or ""

    invited: List[InviteOut] = []
    updated: List[InviteOut] = []
    invalid: List[str] = []
    emailed_count = 0
    seen = set()

    for raw in payload.emails:
        email = (raw or "").strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        if not _EMAIL_RE.match(email):
            invalid.append(raw)
            continue
        try:
            rec, is_user = await _create_or_update_invite(email, payload.role)
        except Exception as e:
            logger.warning(f"Bulk invite failed for {email}: {e}")
            invalid.append(raw)
            continue
        out = InviteOut(email=rec["email"], role=rec["role"], invited_at=rec.get("invited_at"))
        if is_user:
            updated.append(out)
        else:
            per_link = _base_sign_in_url(request, invite_email=email, invite_role=payload.role)
            sent = await _send_invite_email_safe(
                invitee_email=email,
                role=payload.role,
                invited_by_name=inviter_name,
                sign_in_url=per_link,
            )
            if sent:
                emailed_count += 1
            out.emailed = sent
            invited.append(out)

    return {
        "invited": [i.model_dump() for i in invited],
        "updated": [i.model_dump() for i in updated],
        "invalid": invalid,
        "emailed": emailed_count,
    }


@router.delete("/invites/{email}")
async def delete_invite(email: str, _=Depends(require_admin)):
    email = email.strip().lower()
    await db.invites.delete_one({"email": email})
    return {"ok": True}
