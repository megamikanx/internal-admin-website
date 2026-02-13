from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from fastapi import HTTPException

from datetime import datetime, timezone

from app.models.user import user as user_model
from app.models.drink_order import drink_order as drink_order_model
from app.schemas import drink_order as drink_order_schema
from app.core.enums import DrinkOrderStatus

def create_drink_order(db: Session, drink_order: drink_order_schema.DrinkOrderCreate, user_id: int):
    """
    Create a new drink order for a user.
    """
    # Verify the user exists
    user = db.query(user_model).filter(user_model.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Create new order
    db_drink_order = drink_order_model(
        user_id=user_id,
        drink_name=drink_order.drink_name,
        product_url=str(drink_order.product_url),
        status=DrinkOrderStatus.pending
    )
    db.add(db_drink_order)
    
    # Log drink order
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not register the order.")

    db.refresh(db_drink_order)
    
    return drink_order_schema.DrinkOrderRead.model_validate(db_drink_order)

def update_status_to_approved(db: Session, order_id: int, actor: user_model):
    """
    Update the order status to approved.
    """
    # Verify the order exists
    order = db.query(drink_order_model).filter(
        drink_order_model.order_id == order_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    
    # Only pending orders can be approved
    if order.status != DrinkOrderStatus.pending:
        raise HTTPException(status_code=409, detail="Only pending orders can be approved.")
    
    order.status = DrinkOrderStatus.approved
    order.reviewed_by = actor.user_id
    order.reviewed_at = datetime.now(timezone.utc)
    
    # Commit DB update
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not approve the order.")

    db.refresh(order)

    return drink_order_schema.DrinkOrderRead.model_validate(order)

def reject_order(db: Session, order_id: int, actor: user_model, reason: str | None = None,):
    """
    Admin rejects an order with an optional reason.
    """
    # Verify the order exists
    order = db.query(drink_order_model).filter(
        drink_order_model.order_id == order_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    
    # Only pending orders can be rejected
    if order.status != DrinkOrderStatus.pending:
        raise HTTPException(status_code=409, detail="Only pending orders can be rejected.")

    order.status = DrinkOrderStatus.rejected
    order.reviewed_by = actor.user_id
    order.reviewed_at = datetime.now(timezone.utc)
    if reason is not None:
        order.reason = reason.strip()

    # Commit DB update
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not reject the order.")
    
    return None

def cancel_order(db: Session, order_id: int, user_id: int):
    """
    Allow the order creator to cancel their own order.
    """
    # Verify the order exists
    order = db.query(drink_order_model).filter(
        drink_order_model.order_id == order_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    
    # Ensure the requester is the order creator
    if order.user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the order creator can cancel this order.")
    
    # Only pending orders can be cancelled
    if order.status != DrinkOrderStatus.pending:
        raise HTTPException(status_code=409, detail="Only pending orders can be cancelled.")
  
    db.delete(order)

    # Commit DB update
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not cancel the order.")
    
    return None

def list_orders_by_user(db: Session, user_id: int):
    """
    List orders for a specific user.
    """
    orders = (
        db.query(drink_order_model)
        .options(selectinload(drink_order_model.reviewer))
        .filter(drink_order_model.user_id == user_id)
        .all()
    )
    result: list[drink_order_schema.DrinkOrderUserRead] = []

    for order in orders:
        reviewer_name = order.reviewer.nickname if order.reviewer else None
        result.append(
            drink_order_schema.DrinkOrderUserRead(
                order_id=order.order_id,
                drink_name=order.drink_name,
                product_url=order.product_url,
                status=order.status,
                submitted_at=order.submitted_at,
                reviewed_by=order.reviewed_by,
                reviewed_by_name=reviewer_name,
                reason=order.reason,
            )
        )
    return result

def list_all_orders(db: Session):
    """
    List all orders (admin view).
    """
    orders = (
        db.query(drink_order_model)
        .options(selectinload(drink_order_model.reviewer))
        .order_by(drink_order_model.order_id.desc())
        .all()
    )
    result: list[drink_order_schema.DrinkOrderAdminRead] = []

    for order in orders:
        reviewer_name = order.reviewer.nickname if order.reviewer else None
        result.append(
            drink_order_schema.DrinkOrderAdminRead(
                order_id=order.order_id,
                user_id=order.user_id,
                reviewed_by=order.reviewed_by,
                reviewed_by_name=reviewer_name,
                reviewed_at=order.reviewed_at,
                submitted_at=order.submitted_at,
                reason=order.reason,
                drink_name=order.drink_name,
                product_url=order.product_url,
                status=order.status,
            )
        )
    return result
