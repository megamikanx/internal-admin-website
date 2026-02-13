import asyncio
import contextlib
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import (
    SESSION_SECRET_KEY,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
    SESSION_SAME_SITE,
    SESSION_HTTPS_ONLY,
    CORS_ALLOW_ORIGINS,
    GOOGLE_SYNC_INTERVAL_SECONDS,
)
from app.db import SessionLocal
from app.services import google_calendar_service
from app.routers import (
    user_router,
    room_router,
    meeting_router,
    drink_order_router,
    auth_router,
)

SYNC_ABS_FORWARD = 14
SYNC_ABS_BACKWARD = 1

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY,
    session_cookie=SESSION_COOKIE_NAME,
    max_age=SESSION_MAX_AGE,
    same_site=SESSION_SAME_SITE,
    https_only=SESSION_HTTPS_ONLY,
)

app.include_router(user_router)
app.include_router(room_router)
app.include_router(meeting_router)
app.include_router(drink_order_router) 
app.include_router(auth_router)

_google_sync_task: asyncio.Task | None = None

async def _google_sync_loop():
    while True:
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            time_min = now - timedelta(days=SYNC_ABS_BACKWARD)
            time_max = now + timedelta(days=SYNC_ABS_FORWARD)
            google_calendar_service.sync_all_users(
                db,
                time_min=time_min,
                time_max=time_max,
            )
        finally:
            db.close()
        await asyncio.sleep(GOOGLE_SYNC_INTERVAL_SECONDS)


@app.on_event("startup")
async def start_google_sync():
    global _google_sync_task
    if _google_sync_task is None:
        _google_sync_task = asyncio.create_task(_google_sync_loop())


@app.on_event("shutdown")
async def stop_google_sync():
    if _google_sync_task:
        _google_sync_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _google_sync_task

@app.get("/")
def root():
    return {"ok": True}

@app.get("/health")
def health():
    return {"status": "ok"}
