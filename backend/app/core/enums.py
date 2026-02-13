import enum

# Drink order status
class DrinkOrderStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

# Teams
class Teams(str, enum.Enum):
    dev = "DEV"
    data = "DATA"
    product = "PRODUCT"
    customer_service = "CS"
    operations = "OPS"

# Google calendar response status
class ResponseStatus(str, enum.Enum):
    needsAction = "needsAction"
    accepted = "accepted"
    tentative = "tentative"
    declined = "declined"