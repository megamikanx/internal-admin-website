# scripts/seed.py
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.user import user as User
from app.core.security import password_hash

from app.core.enums import Teams

ADMIN = {
    "email": "admin@teamremited.com",
    "name": "Admin",
    "nickname": "Admin",
    "password": "Admin123!!",
    "admin_status": True,
    "team": Teams.operations,
}


def upsert_user(
    db: Session,
    *,
    email: str,
    name: str,
    nickname: str,
    password: str,
    admin_status: bool,
    team: Teams,
) -> User:
    u = db.query(User).filter(User.email == email).first()
    if u:
        u.name = name
        u.nickname = nickname
        u.admin_status = admin_status
        u.team = team
        # Seed scripts typically always set password to a known value for easier testing
        u.password_hash = password_hash.hash(password)
        return u

    u = User(
        email=email,
        name=name,
        nickname=nickname,
        admin_status=admin_status,
        team=team,
        password_hash=password_hash.hash(password),
    )
    db.add(u)
    return u


def main():
    db = SessionLocal()
    try:
        upsert_user(db, **ADMIN)
        # for u in USERS:
        #     upsert_user(db, **u)

        db.commit()

        print("✅ Seed complete.")
        print("Admin:", ADMIN["email"], "/", ADMIN["password"])
        # print("Users:", [u["email"] for u in USERS])

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

