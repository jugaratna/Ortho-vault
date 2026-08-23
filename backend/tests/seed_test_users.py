"""Seed test users + sessions directly in Mongo for auth boundary tests.

Creates three users (admin, editor, editor2, viewer) with known Bearer tokens.
Idempotent: safe to re-run.
"""
import asyncio
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

USERS = [
    {"user_id": "user_test_admin", "email": "admin@ortho.test", "role": "admin",  "token": "test_token_admin"},
    {"user_id": "user_test_ed1",   "email": "ed1@ortho.test",   "role": "editor", "token": "test_token_editor1"},
    {"user_id": "user_test_ed2",   "email": "ed2@ortho.test",   "role": "editor", "token": "test_token_editor2"},
    {"user_id": "user_test_view",  "email": "view@ortho.test",  "role": "viewer", "token": "test_token_viewer"},
]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=7)
    for u in USERS:
        await db.users.update_one(
            {"user_id": u["user_id"]},
            {"$set": {
                "user_id": u["user_id"], "email": u["email"], "name": u["email"].split("@")[0],
                "picture": "", "role": u["role"], "created_at": now,
            }},
            upsert=True,
        )
        await db.user_sessions.update_one(
            {"session_token": u["token"]},
            {"$set": {"session_token": u["token"], "user_id": u["user_id"], "created_at": now, "expires_at": expires}},
            upsert=True,
        )
    # Cleanup any stale test patients from prior runs
    await db.patients.delete_many({"name": {"$regex": "^TEST_"}})
    print("seeded users:", [u["user_id"] for u in USERS])
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
