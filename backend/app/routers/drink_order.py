from fastapi import APIRouter, Depends, status, Response

from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_admin
from app.db import get_db
from app.schemas import drink_order as drink_order_schema
from app.services import drink_order_service

# Only accessible to logged-in users
router = APIRouter(
    prefix="/drink-orders",
    tags=["drink-orders"],
    dependencies=[Depends(get_current_user)],  
)

@router.post("", response_model=drink_order_schema.DrinkOrderRead, status_code=status.HTTP_201_CREATED)
def create_drink_order(
    drink_order: drink_order_schema.DrinkOrderCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new drink order for the current user.

    Args:
        drink_order (DrinkOrderCreate): Payload for creating the order.
        current_user: Provided by `get_current_user` dependency.
        db (Session): Database session dependency.

    Returns:
        DrinkOrderRead: The created drink order.
    """
    return drink_order_service.create_drink_order(db, drink_order, current_user.user_id)

@router.get("/me", response_model=list[drink_order_schema.DrinkOrderUserRead])
def list_my_drink_orders(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List drink orders submitted by the current user.

    Args:
        current_user: Provided by `get_current_user` dependency.
        db (Session): Database session dependency.

    Returns:
        list[DrinkOrderUserRead]: List of the user's drink orders.
    """
    return drink_order_service.list_orders_by_user(db, current_user.user_id)

@router.get("", response_model=list[drink_order_schema.DrinkOrderAdminRead])
def list_all_orders(
    db: Session = Depends(get_db),
    _ = Depends(require_admin),
):
    """List all drink orders (admin only).

    Args:
        db (Session): Database session dependency.

    Returns:
        list[DrinkOrderAdminRead]: All drink orders.
    """
    return drink_order_service.list_all_orders(db)

@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_drink_order(
    order_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancel the current user's drink order identified by `order_id`.
    """
    drink_order_service.cancel_order(db, order_id, current_user.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.patch("/{order_id}/approve", response_model=drink_order_schema.DrinkOrderRead)
def approve_drink_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin),
):
    """
    Approve a drink order (admin only).
    """
    return drink_order_service.update_status_to_approved(db, order_id, current_user)

@router.post("/{order_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_drink_order(
    order_id: int,
    payload: drink_order_schema.DrinkOrderAdminUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """
    Reject a drink order with an optional reason (admin only).
    """
    drink_order_service.reject_order(
        db,
        order_id,
        current_user,
        reason=payload.reason,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
