import logging
import time

from fastapi import APIRouter, Depends, status, Response

from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_admin
from app.db import get_db
from app.schemas import user as user_schema
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])

@router.post("", response_model=user_schema.UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    user: user_schema.UserCreate,
    db: Session = Depends(get_db),
    _ = Depends(require_admin),
):
    """Create a new user (admin only).

    Args:
        user (UserCreate): Payload for the new user.
        db (Session): Database session dependency.

    Returns:
        UserRead: The created user.
    """
    return user_service.create_user(db, user)

@router.get("", response_model=list[user_schema.UserRead])
def list_users(
    db: Session = Depends(get_db),
    _ = Depends(require_admin),
):
    """List all users (admin only).

    Args:
        db (Session): Database session dependency.

    Returns:
        list[UserRead]: All users.
    """
    return user_service.list_users(db)

@router.get("/search", response_model=list[user_schema.UserRead])
def search_users(
    query: str,
    db: Session = Depends(get_db),
    _ = Depends(get_current_user),
):
    """Search users by the provided query string.

    Args:
        query (str): Search query to match against users.
        db (Session): Database session dependency.

    Returns:
        list[UserRead]: Matching users.
    """
    logger = logging.getLogger("uvicorn.error")
    start_total = time.perf_counter()
    results = user_service.search_users(db, query)
    end_total = time.perf_counter()
    logger.info(f"[USER SEARCH] query='{query}' total_time={end_total - start_total:.6f}s")
    return results

@router.patch("/me", response_model=user_schema.UserRead)
def update_me(
    user_update: user_schema.UserUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current authenticated user's profile.

    Args:
        user_update (UserUpdate): Fields to update for the current user.
        current_user: The authenticated user.
        db (Session): Database session dependency.

    Returns:
        UserRead: The updated user.
    """
    return user_service.update_user(db, current_user.user_id, user_update)

@router.patch("/{user_id}", response_model=user_schema.UserRead)
def admin_update_user(
    user_id: int,
    user_update: user_schema.UserUpdate,
    db: Session = Depends(get_db),
    _ = Depends(require_admin),
):
    """Admin updates a user's profile.

    Args:
        user_id (int): ID of the user to update.
        user_update (UserUpdate): Fields to update.
        db (Session): Database session dependency.

    Returns:
        UserRead: The updated user.
    """
    return user_service.update_user(db, user_id, user_update)

@router.post("/{user_id}/promote", response_model=user_schema.UserRead)
def promote_user(
    user_id: int,
    db: Session = Depends(get_db),
    _ = Depends(require_admin),
):
    """Promote a regular user to administrator.

    Args:
        user_id (int): ID of the user to promote.
        db (Session): Database session dependency.

    Returns:
        UserRead: The promoted user.
    """
    return user_service.promote_to_admin(db, user_id)

@router.post("/{user_id}/demote", response_model=user_schema.UserRead)
def demote_user(
    user_id: int,
    db: Session = Depends(get_db),
    _ = Depends(require_admin),
):
    """Demote an administrator to a regular user.

    Args:
        user_id (int): ID of the user to demote.
        db (Session): Database session dependency.

    Returns:
        UserRead: The demoted user.
    """
    return user_service.demote_from_admin(db, user_id)

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _ = Depends(require_admin),
):
    """Delete a user (admin only).

    Args:
        user_id (int): ID of the user to delete.
        db (Session): Database session dependency.

    Returns:
        Response: HTTP 204 No Content on success.
    """
    user_service.delete_user(db, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def update_own_password(
    payload: user_schema.UserPasswordUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's password.

    Args:
        payload (UserPasswordUpdate): Current and new password values.
        current_user: The authenticated user.
        db (Session): Database session dependency.

    Returns:
        Response: HTTP 204 No Content on success.
    """
    user_service.update_own_password(
        db,
        actor_id=current_user.user_id,
        curr_password=payload.current_password,
        new_password=payload.new_password,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/{user_id}/reset-password", response_model=user_schema.UserRead)
def admin_reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    _ = Depends(require_admin),
):
    """
    Admin resets a user's password and returns the user.
    """
    return user_service.admin_reset_password(db, user_id)