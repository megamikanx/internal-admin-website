from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from sqlalchemy.orm import Session
from app.db import get_db

from app.core.security import get_current_user
from app.core.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    FRONTEND_REDIRECT_URI,
)
from app.services import google_calendar_service
from app.schemas import user as user_schema
from app.services import user_service

import time
import logging

router = APIRouter(prefix="/auth", tags=["auth"])
GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar",
]

SYNC_ABS_TIME = 14

@router.post("/login", status_code=status.HTTP_204_NO_CONTENT)
def login(payload: user_schema.UserLogin, request: Request, db: Session = Depends(get_db),):
    """Authenticate a user and create a session.

    Args:
        payload (UserLogin): The login payload containing email and password.
        request (Request): The incoming FastAPI request (used for session).
        db (Session): Database session dependency.

    Returns:
        Response: HTTP 204 No Content on successful login.
    """
    logger = logging.getLogger("uvicorn.error")

    start_total = time.perf_counter()

    # Authenticate email and password
    start_auth = time.perf_counter()
    user = user_service.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Email and password do not match.")
    end_auth = time.perf_counter()
    logger.debug(f"[LOGIN] authenticate_user time taken: {end_auth - start_auth:.6f} seconds")

    # Save session info
    start_session = time.perf_counter()
    request.session.clear()
    request.session["user_id"] = int(user.user_id)
    request.session["admin_status"] = bool(user.admin_status)
    end_session = time.perf_counter()
    logger.debug(f"[LOGIN] session save time taken: {end_session - start_session:.6f} seconds")

    end_total = time.perf_counter()
    logger.info(f"[LOGIN] Total login time taken: {end_total - start_total:.6f} seconds")

    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request):
    """Log out the current user by clearing the session.

    Args:
        request (Request): The incoming FastAPI request (used for session).

    Returns:
        Response: HTTP 204 No Content on successful logout.
    """
    logger = logging.getLogger("uvicorn.error")

    start_total = time.perf_counter()

    start_session = time.perf_counter()
    request.session.clear()
    end_session = time.perf_counter()
    logger.debug(f"[LOGOUT] session clear time taken: {end_session - start_session:.6f} seconds")

    end_total = time.perf_counter()
    logger.info(f"[LOGOUT] Total logout time taken: {end_total - start_total:.6f} seconds")

    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/me", response_model=user_schema.UserRead)
def get_me(current_user = Depends(get_current_user),):
    """Return the current authenticated user's profile.

    Args:
        current_user: Provided by the `get_current_user` dependency.

    Returns:
        UserRead: The serialized current user.
    """
    return user_schema.UserRead.model_validate(current_user)

@router.get("/google")
def google_login(request: Request, current_user = Depends(get_current_user)):
    """Begin Google OAuth flow to connect a Google account for the current user.

    Args:
        request (Request): The incoming request (used to store OAuth state in session).
        current_user: The authenticated user from session.

    Returns:
        RedirectResponse: Redirects the user to Google's OAuth consent screen.
    """
    logger = logging.getLogger("uvicorn.error")
    start_total = time.perf_counter()

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth env variables not set")

    start_flow = time.perf_counter()

    # Google OAuth client settings
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    # Google OAuth flow creation
    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )
    # Google OAuth authorization URL creation
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    # Store state in session
    request.session["google_oauth_state"] = state
    request.session["google_oauth_mode"] = "connect"
    end_flow = time.perf_counter()
    logger.debug(f"[GOOGLE CONNECT] oauth_url creation time taken: {end_flow - start_flow:.6f} seconds")

    end_total = time.perf_counter()
    logger.info(f"[GOOGLE CONNECT] Total request time taken: {end_total - start_total:.6f} seconds")
    return RedirectResponse(url=authorization_url, status_code=status.HTTP_302_FOUND)


@router.get("/google/login")
def google_login_start(request: Request):
    """
    Begin Google OAuth flow to sign in with Google without an existing session.
    """
    logger = logging.getLogger("uvicorn.error")
    start_total = time.perf_counter()

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth env variables not set")

    start_flow = time.perf_counter()
    # Google OAuth client settings
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    # Google OAuth flow creation
    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )
    # Google OAuth authorization URL creation
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    # Store state in session
    request.session["google_oauth_state"] = state
    request.session["google_oauth_mode"] = "login"
    end_flow = time.perf_counter()
    logger.debug(f"[GOOGLE LOGIN] oauth_url creation time taken: {end_flow - start_flow:.6f} seconds")

    end_total = time.perf_counter()
    logger.info(f"[GOOGLE LOGIN] Total request time taken: {end_total - start_total:.6f} seconds")
    return RedirectResponse(url=authorization_url, status_code=status.HTTP_302_FOUND)


@router.get("/google/callback")
def google_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Handle Google's OAuth callback, linking or creating a user account.
    """
    logger = logging.getLogger("uvicorn.error")
    start_total = time.perf_counter()

    if request.query_params.get("error"):
        raise HTTPException(status_code=400, detail="Google OAuth authorization error.")
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth env variables not set")

    # Retrieve state and mode from session
    state = request.session.get("google_oauth_state")
    mode = request.session.get("google_oauth_mode", "connect")
    if not state:
        raise HTTPException(status_code=400, detail="OAuth state missing from session.")
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        state=state,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )
    start_token = time.perf_counter()
    flow.fetch_token(authorization_response=str(request.url))
    credentials = flow.credentials
    end_token = time.perf_counter()
    logger.debug(f"[GOOGLE CALLBACK] token 교환 소요 시간: {end_token - start_token:.6f}초")

    # When in login mode, authenticate or create user account
    if mode == "login":
        start_profile = time.perf_counter()
        oauth_service = build("oauth2", "v2", credentials=credentials)
        profile = oauth_service.userinfo().get().execute()
        email = profile.get("email")
        full_name = profile.get("name") or profile.get("given_name") or ""
        end_profile = time.perf_counter()
        logger.debug(f"[GOOGLE CALLBACK] view profile time taken: {end_profile - start_profile:.6f} seconds")
        if not email:
            raise HTTPException(status_code=400, detail="Cannot retrieve email from Google account.")
        user = user_service.get_user_by_email(db, email)
        # If user does not exist, create new account
        if not user:
            user = user_service.create_user_from_google(
                db,
                email=email,
                name=full_name,
            )
        # Save session info
        request.session.clear()
        request.session["user_id"] = int(user.user_id)
        request.session["admin_status"] = bool(user.admin_status)
        user_service.update_google_auth(
            db,
            user.user_id,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_expiry=credentials.expiry,
        )
        # Delete OAuth state and mode from session
        request.session.pop("google_oauth_state", None)
        request.session.pop("google_oauth_mode", None)
        end_total = time.perf_counter()
        logger.info(f"[GOOGLE CALLBACK] total request time taken: {end_total - start_total:.6f} seconds")
        return RedirectResponse(url=FRONTEND_REDIRECT_URI, status_code=status.HTTP_302_FOUND)

    # If in connect mode, link Google account to current user
    current_user_id = request.session.get("user_id")
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Login required to connect Google account.")

    user_service.update_google_auth(
        db,
        current_user_id,
        access_token=credentials.token,
        refresh_token=credentials.refresh_token,
        token_expiry=credentials.expiry,
    )
    # Delete OAuth state and mode from session
    request.session.pop("google_oauth_state", None)
    request.session.pop("google_oauth_mode", None)
    end_total = time.perf_counter()
    logger.info(f"[GOOGLE CALLBACK] total request time taken: {end_total - start_total:.6f} seconds")
    return {"status": "ok"}


@router.post("/google/sync")
def google_sync_now(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Trigger an immediate Google Calendar synchronization for the current user.
    """
    logger = logging.getLogger("uvicorn.error")
    start_total = time.perf_counter()

    if not current_user.google_access_token:
        raise HTTPException(status_code=400, detail="Google account is not connected.")
    now = datetime.now(timezone.utc)
    time_min = now - timedelta(days=SYNC_ABS_TIME)
    time_max = now + timedelta(days=SYNC_ABS_TIME)
    start_sync = time.perf_counter()
    google_calendar_service.sync_user_calendar(
        db,
        current_user,
        time_min=time_min,
        time_max=time_max,
    )
    end_sync = time.perf_counter()
    logger.debug(f"[GOOGLE SYNC] sync time taken: {end_sync - start_sync:.6f} seconds")
    synced_at = google_calendar_service.set_last_sync().isoformat()
    end_total = time.perf_counter()
    logger.info(f"[GOOGLE SYNC] total request time taken: {end_total - start_total:.6f} seconds")
    return {"status": "ok", "synced_at": synced_at}


@router.get("/google/sync/status")
def google_sync_status(
    _ = Depends(get_current_user),
):
    """
    Return the last Google Calendar synchronization timestamp.
    """
    last_sync = google_calendar_service.get_last_sync()
    return {"last_synced_at": last_sync.isoformat() if last_sync else None}
