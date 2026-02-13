import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from dotenv import load_dotenv

load_dotenv()

# Read env variables
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")  
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not DB_USER or not DB_PASSWORD:
    raise RuntimeError(
        "Missing DB_USER/DB_PASSWORD environment variables. "
    )

# Escape password for URL
password_escaped = quote_plus(DB_PASSWORD)

# Construct the database URL
SQLALCHEMY_DB_URL = (
    f"postgresql+psycopg2://{DB_USER}:{password_escaped}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# Create the SQLAlchemy engine
engine = create_engine(
    SQLALCHEMY_DB_URL,
    pool_pre_ping=True,  
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Provide a database session generator for dependency injection.

    This yields a new SQLAlchemy `Session` and ensures it is closed
    after use.

    Yields:
        Session: A SQLAlchemy session instance.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_table():
    """Create all database tables defined on the declarative `Base`.

    This calls SQLAlchemy's `create_all` using the module's engine.
    """
    Base.metadata.create_all(bind=engine)
