from fastapi import Depends, HTTPException, Request, status
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import user as user_model

# Create password hash using pwdlib
password_hash = PasswordHash.recommended()

def get_password_hash(password: str) -> str:
    """Create a secure hash of the given password.

    Args:
        password (str): The plaintext password to hash.

    Returns:
        str: The hashed password.
    """
    return password_hash.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify that a plaintext password matches a hashed password.

    Args:
        password (str): The plaintext password to verify.
        hashed_password (str): The stored hashed password to compare against.

    Returns:
        bool: True if the password matches the hash, False otherwise.
    """
    return password_hash.verify(password, hashed_password)

def get_current_user(request: Request, db: Session = Depends(get_db)):
    """Retrieve the currently authenticated user from the session.

    Raises:
        HTTPException: 401 if no authenticated user or session is invalid.

    Args:
        request (Request): The FastAPI request object containing the session.
        db (Session): Database session injected by dependency.

    Returns:
        The user model instance corresponding to the current session's user.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    user = db.query(user_model).filter(user_model.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session.")
    return user

def require_admin(current_user = Depends(get_current_user)):
    """Ensure the current user has administrator privileges.

    Raises:
        HTTPException: 403 if the current user is not an administrator.

    Args:
        current_user: The user object provided by the `get_current_user` dependency.

    Returns:
        The `current_user` if they have admin privileges.
    """
    if not current_user.admin_status:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user