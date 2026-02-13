import os

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from datetime import timezone

from fastapi import HTTPException

from app.models.user import user as user_model
from app.schemas import user as user_schema
from app.core.security import get_password_hash, verify_password
from app.core.enums import Teams

from dotenv import load_dotenv

load_dotenv()

DEFAULT_INITIAL_PASSWORD = os.getenv("DEFAULT_PASSWORD")

# Constants 
DEFAULT_GOOGLE_CALENDAR_ID = "primary"

# 계정 상태 관련
def create_user(db: Session, user: user_schema.UserCreate):
    """Create a new user with a default initial password."""
    # Check whether the email or nickname is already in use
    existing_user = db.query(user_model).filter(
        (user_model.email == user.email.lower()) | 
        (user_model.nickname == user.nickname.lower())
    ).first()

    if existing_user:
        raise HTTPException(status_code=409, detail="Email or nickname is already in use.")
    
    # Set default initial password and hash it
    hashed_password = get_password_hash(DEFAULT_INITIAL_PASSWORD)

    # Create new user
    db_user = user_model(
        nickname=user.nickname,
        name=user.name,
        email=user.email,
        password_hash=hashed_password,
        admin_status=False,
        team=user.team,
    )
    db.add(db_user)

    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email or nickname is already in use.")

    db.refresh(db_user)

    return user_schema.UserRead.model_validate(db_user)

def delete_user(db: Session, user_id: int):
    """Delete a user, ensuring at least one admin remains."""
    # Verify the user exists

    user = db.query(user_model).filter(user_model.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    # Ensure there is at least one other admin
    if user.admin_status:
        admin_count = db.query(func.count(user_model.user_id)).filter(
            user_model.admin_status.is_(True)
        ).scalar()
        if admin_count is not None and admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="At least one administrator account is required.",
            )
    
    db.delete(user)
    
    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not delete the account.")

    return None

def update_user(db: Session, user_id: int, user_update: user_schema.UserUpdate):
    """Update a user's profile information."""
    # Verify the user exists
    db_user = db.query(user_model).filter(user_model.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Account not found.")

    # 중복 확인
    if user_update.email is not None and user_update.email != db_user.email:
        existing_user = db.query(user_model).filter(
            (user_model.email == user_update.email.lower()) &
            (user_model.user_id != user_id)
        ).first()
        if existing_user:
            raise HTTPException(status_code=409, detail="Email is already in use.")

    if user_update.nickname is not None and user_update.nickname != db_user.nickname:
        existing_user = db.query(user_model).filter(
            (user_model.nickname == user_update.nickname.lower()) &
            (user_model.user_id != user_id)
        ).first()
        if existing_user:
            raise HTTPException(status_code=409, detail="Nickname is already in use.")

    # 업데이트 반영
    if user_update.nickname is not None:
        db_user.nickname = user_update.nickname

    if user_update.name is not None:
        db_user.name = user_update.name

    if user_update.email is not None:
        db_user.email = user_update.email

    if user_update.team is not None:
        db_user.team = user_update.team


    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="One of the values is already in use.")

    db.refresh(db_user)

    return user_schema.UserRead.model_validate(db_user)

def update_own_password(db: Session, actor_id: int, curr_password: str, new_password: str) -> None:
    """Update the authenticated user's own password."""
    # Verify the user exists
    db_user = db.query(user_model).filter(user_model.user_id == actor_id).first()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="Account not found.")

    # 현재 비밀번호 일치 확인
    if not verify_password(curr_password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password does not match.")

    # 새 비밀번호 해시화
    db_user.password_hash = get_password_hash(new_password)

    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not change the password.")

    return None

# 어드민 권한 관련
def promote_to_admin(db: Session, user_id: int):
    """Promote a regular user to administrator."""
    # Verify the user exists and grant admin
    db_user = db.query(user_model).filter(user_model.user_id == user_id).first()

    if not db_user:
        raise HTTPException(status_code=404, detail="Account not found.")

    if db_user.admin_status is True:
        return user_schema.UserRead.model_validate(db_user)

    db_user.admin_status = True

    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update the account.")

    db.refresh(db_user)

    return user_schema.UserRead.model_validate(db_user)

def demote_from_admin(db: Session, user_id: int):
    """Demote an administrator to a regular user."""
    # Verify the user exists and perform demotion
    db_user = db.query(user_model).filter(user_model.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Account not found.")

    if db_user.admin_status is False:
        return user_schema.UserRead.model_validate(db_user)

    # 관리자 계정이 한개 이상인지 확인
    admin_count = db.query(func.count(user_model.user_id)).filter(
        user_model.admin_status.is_(True)
    ).scalar()
    if admin_count is not None and admin_count <= 1:
        raise HTTPException(
            status_code=400,
            detail="At least one administrator account is required.",
        )

    db_user.admin_status = False

    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update the account.")

    db.refresh(db_user)

    return user_schema.UserRead.model_validate(db_user)

def list_users(db: Session):
    """List all users."""
    users = db.query(user_model).order_by(user_model.user_id.asc()).all()

    return [user_schema.UserRead.model_validate(u) for u in users]

def search_users(db: Session, query: str):
    """Search users by a query string (nickname, name, or email)."""
    # Normalize query and perform search
    normalized = query.strip()

    if not normalized:
        return []

    pattern = f"%{normalized.lower()}%"

    users = db.query(user_model).filter(
        user_model.nickname.like(pattern)
        | user_model.name.like(pattern)
        | user_model.email.like(pattern)
    ).order_by(user_model.user_id.asc()).all()

    return [user_schema.UserRead.model_validate(u) for u in users]

# 인증 관련
def authenticate_user(db: Session, email: str, password: str) -> user_model | None:
    """Authenticate a user by email and password."""
    # Normalize email and authenticate
    normalized_email = email.strip()

    user = db.query(user_model).filter(
        user_model.email == normalized_email
    ).first()

    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None

    return user

def admin_reset_password(db: Session, user_id: int):
    """Admin resets a user's password to the default initial password."""
    # Verify the user exists
    db_user = db.query(user_model).filter(user_model.user_id == user_id).first()

    if not db_user:
        raise HTTPException(status_code=404, detail="Account not found.")

    # Reset password to default and hash it
    db_user.password_hash = get_password_hash(DEFAULT_INITIAL_PASSWORD)

    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not change the password.")

    db.refresh(db_user)
    
    return user_schema.UserRead.model_validate(db_user)


def update_google_auth(
    db: Session,
    user_id: int,
    *,
    access_token: str,
    refresh_token: str | None,
    token_expiry,
    calendar_id: str | None = None,
) -> None:
    """Store Google OAuth tokens for a user."""
    db_user = db.query(user_model).filter(user_model.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Account not found.")

    db_user.google_access_token = access_token
    if refresh_token:
        db_user.google_refresh_token = refresh_token
    if token_expiry and token_expiry.tzinfo is not None:
        token_expiry = token_expiry.astimezone(timezone.utc).replace(tzinfo=None)
    db_user.google_token_expiry = token_expiry
    if calendar_id:
        db_user.google_calendar_id = calendar_id
    elif not db_user.google_calendar_id:
        db_user.google_calendar_id = DEFAULT_GOOGLE_CALENDAR_ID

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not save Google authentication information.")

    db.refresh(db_user)
    return None


def get_user_by_email(db: Session, email: str) -> user_model | None:
    """Get a user by email, or None if not found."""
    normalized_email = email.strip()
    if not normalized_email:
        return None
    return db.query(user_model).filter(
        user_model.email == normalized_email
    ).first()


def _generate_unique_nickname(db: Session, base: str) -> str:
    normalized = base.strip() or "User"
    candidate = normalized
    suffix = 1
    while db.query(user_model).filter(
        user_model.nickname == candidate.lower()
    ).first():
        candidate = f"{normalized}{suffix}"
        suffix += 1
    return candidate


def create_user_from_google(
    db: Session,
    *,
    email: str,
    name: str,
):
    """Create a new user from Google OAuth login information."""
    normalized_email = email.strip().lower()
    if not normalized_email:
        raise HTTPException(status_code=400, detail="Email information is missing.")

    nickname = _generate_unique_nickname(db, "User")
    display_name = "User"

    db_user = user_model(
        nickname=nickname,
        name=display_name,
        email=normalized_email,
        password_hash=get_password_hash(DEFAULT_INITIAL_PASSWORD),
        admin_status=False,
        team=Teams.operations,
    )
    db.add(db_user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Account already registered.")

    db.refresh(db_user)
    return db_user


