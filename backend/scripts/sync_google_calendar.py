from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from app.db import SessionLocal
from app.models.user import user as user_model
from app.services import google_calendar_service


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _get_user(db: Session, user_id: int | None, email: str | None) -> user_model | None:
    if user_id is not None:
        return db.query(user_model).filter(user_model.user_id == user_id).first()
    if email:
        return db.query(user_model).filter(user_model.email == email).first()
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Google Calendar events into DB.")
    parser.add_argument("--user-id", type=int, help="User ID to sync")
    parser.add_argument("--email", type=str, help="User email to sync")
    parser.add_argument(
        "--all-users",
        action="store_true",
        help="Sync all users with Google tokens",
    )
    parser.add_argument(
        "--time-min",
        type=str,
        default="2026-01-01T00:00:00+00:00",
        help="ISO timestamp for sync start (default: 2026-01-01 UTC)",
    )
    parser.add_argument(
        "--time-max",
        type=str,
        default=None,
        help="ISO timestamp for sync end (optional)",
    )
    args = parser.parse_args()

    time_min = _parse_datetime(args.time_min)
    time_max = _parse_datetime(args.time_max)

    if not args.all_users and args.user_id is None and not args.email:
        print("Provide --user-id, --email, or --all-users", file=sys.stderr)
        return 2

    db = SessionLocal()
    try:
        if args.all_users:
            google_calendar_service.sync_all_users(db)
            return 0
        user = _get_user(db, args.user_id, args.email)
        if not user:
            print("User not found", file=sys.stderr)
            return 2
        google_calendar_service.sync_user_calendar(
            db,
            user,
            time_min=time_min,
            time_max=time_max,
        )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
