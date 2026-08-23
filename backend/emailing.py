"""Emergent managed transactional email (Resend proxy) with a hard guardrail gate.

Only server-side, fixed templates. Never expose a route that takes a recipient,
subject, or HTML body from a caller (G4).
"""
import re
import ipaddress
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
import httpx
from fastapi import HTTPException
from config import (
    EMAIL_BASE_URL, EMAIL_KEY, EMAIL_FROM_NAME, EMAIL_REPLY_TO, logger,
)

# ---------------- Guardrail gate ----------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened/numeric-host/creds-in-URL not allowed: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


# ---------------- Sender ----------------
async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None) -> str | None:
    _assert_safe_email(subject, html)
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY missing — skipping email send")
        return None
    payload = {
        "to": [to],
        "subject": subject,
        "html": html,
        "from_name": EMAIL_FROM_NAME,
    }
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")


# ---------------- Templates (server-side only) ----------------
_ROLE_LABEL = {"admin": "Administrator", "editor": "Editor", "viewer": "Viewer"}
_ROLE_DESC = {
    "admin": "Full access — manage patients, files, team members, and roles",
    "editor": "Add and edit your own patient records and upload media",
    "viewer": "Read-only access to view patient records",
}


def _sanitize_url_for_email(url: str) -> str | None:
    """Only return the URL if it is a clean absolute https URL. Otherwise None."""
    if not url or not isinstance(url, str):
        return None
    u = url.strip()
    if not u.lower().startswith("https://"):
        return None
    p = urlparse(u)
    if p.username is not None:
        return None
    host = p.hostname or ""
    if not _host_ok(host):
        return None
    return u


def build_invite_email(*, invitee_email: str, role: str, invited_by_name: str, sign_in_url: str) -> tuple[str, str]:
    """Return (subject, html) for an invite email. Uses only fixed markup."""
    role = role if role in _ROLE_LABEL else "editor"
    role_label = _ROLE_LABEL[role]
    role_desc = _ROLE_DESC[role]
    subject = f"You're invited to {EMAIL_FROM_NAME}"
    inviter = escape(invited_by_name.strip() or "Your colleague")
    invitee = escape(invitee_email)
    brand = escape(EMAIL_FROM_NAME)
    html = f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fa;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
          <tr><td style="padding:28px 28px 12px 28px">
            <div style="font-size:12px;color:#0f766e;font-weight:700;letter-spacing:1px">{brand}</div>
            <h1 style="margin:8px 0 0 0;font-size:22px;color:#0f172a">You've been invited to {brand}</h1>
          </td></tr>
          <tr><td style="padding:8px 28px 0 28px;color:#334155;font-size:15px;line-height:1.55">
            <p style="margin:12px 0">{inviter} has pre-authorized <strong>{invitee}</strong> to join their {brand} clinic workspace as <strong>{escape(role_label)}</strong>.</p>
            <p style="margin:12px 0;color:#475569;font-size:14px">{escape(role_desc)}.</p>
          </td></tr>
          <tr><td style="padding:20px 28px" align="left">
            <a href="{sign_in_url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:15px">Sign in with Google</a>
          </td></tr>
          <tr><td style="padding:0 28px 8px 28px;color:#64748b;font-size:13px;line-height:1.5">
            <p style="margin:8px 0">Sign in using your <strong>{invitee}</strong> Google account — that's the address your role is tied to. If a different account signs in, your invite won't be applied.</p>
          </td></tr>
          <tr><td style="padding:16px 28px 24px 28px;border-top:1px solid #eef2f7;color:#94a3b8;font-size:12px;line-height:1.5">
            <p style="margin:6px 0">This is a transactional invite from {brand}. We will never ask you for your password, one-time code, or payment details by email.</p>
            <p style="margin:6px 0">If you weren't expecting this, you can ignore this message and no account will be created.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    """.strip()
    return subject, html
