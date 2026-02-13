import os

from dotenv import load_dotenv

load_dotenv()

SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "dev-secret-change-me")
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "session")
SESSION_MAX_AGE = int(os.getenv("SESSION_MAX_AGE", str(60 * 60 * 24 * 7)))

# OAuthlib (local dev over HTTP)
OAUTHLIB_INSECURE_TRANSPORT = os.getenv("OAUTHLIB_INSECURE_TRANSPORT", "")
if OAUTHLIB_INSECURE_TRANSPORT.lower() in {"1", "true", "yes"}:
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

RAW_SESSION_HTTPS_ONLY = os.getenv("SESSION_HTTPS_ONLY")
if RAW_SESSION_HTTPS_ONLY is None:
    SESSION_HTTPS_ONLY = OAUTHLIB_INSECURE_TRANSPORT.lower() not in {"1", "true", "yes"}
else:
    SESSION_HTTPS_ONLY = RAW_SESSION_HTTPS_ONLY.lower() in {"1", "true", "yes"}

RAW_SESSION_SAME_SITE = os.getenv("SESSION_SAME_SITE")
if RAW_SESSION_SAME_SITE:
    SESSION_SAME_SITE = RAW_SESSION_SAME_SITE.lower()
else:
    SESSION_SAME_SITE = "none" if SESSION_HTTPS_ONLY else "lax"

# CORS allowed origins
RAW_CORS_ORIGINS = os.getenv(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:3000,http://localhost:5173",
)
CORS_ALLOW_ORIGINS = [origin.strip() for origin in RAW_CORS_ORIGINS.split(",") if origin.strip()]

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
GOOGLE_SYNC_INTERVAL_SECONDS = int(os.getenv("GOOGLE_SYNC_INTERVAL_SECONDS", "3600"))
FRONTEND_REDIRECT_URI = os.getenv("FRONTEND_REDIRECT_URI", "http://localhost:5173")