import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.engine.url import make_url

# If DATABASE_URL exists (production), use it. Otherwise fallback to SQLite (local).
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./wood_erp.db").strip()

# Normalize common postgres scheme (some providers use postgres://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

url = make_url(DATABASE_URL)
is_sqlite = url.drivername.startswith("sqlite")

# Ensure Postgres uses SSL on Render, unless explicitly configured otherwise.
if (not is_sqlite) and url.drivername.startswith("postgresql"):
    if "sslmode" not in (url.query or {}):
        url = url.set(query={**(url.query or {}), "sslmode": "require"})
        DATABASE_URL = str(url)

engine_kwargs: dict = {
    "future": True,
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # These settings prevent "SSL connection has been closed unexpectedly" on idle pooled conns.
    engine_kwargs.update(
        pool_pre_ping=True,
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "300")),   # seconds
        pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
    )

engine = create_engine(DATABASE_URL, **engine_kwargs)

# SQLite pragmas
if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
