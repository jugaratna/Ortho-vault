"""OrthoVault backend — top-level FastAPI app assembly.

Modules:
  - config.py: env, constants, logger
  - db.py: Mongo client
  - deps.py: current_user, require_admin
  - models.py: Pydantic models
  - storage.py: Emergent Object Storage helpers
  - emailing.py: Emergent Resend + guardrail gate
  - routes/auth.py, routes/patients.py, routes/files.py, routes/ai.py
"""
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from config import logger
from db import db, client
from storage import init_storage_startup

from routes.auth import router as auth_router
from routes.patients import router as patients_router
from routes.files import router as files_router
from routes.ai import router as ai_router


app = FastAPI(title="OrthoVault API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "OrthoVault API", "status": "ok"}


# Mount feature routers under /api
api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(files_router)
api_router.include_router(ai_router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    try:
        await run_in_threadpool(init_storage_startup)
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Object storage init failed at startup: {e}")
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.invites.create_index("email", unique=True)
        logger.info("Indexes ensured")
    except Exception as e:
        logger.warning(f"Index creation failed: {e}")


@app.on_event("shutdown")
async def _shutdown():
    client.close()
