import psycopg
from psycopg.rows import dict_row

from .config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER


def get_conn():
    """FastAPI dependency: one connection per request.
    Commits on success, rolls back on any error, so every request that
    changes data is one transaction (COMMIT / ROLLBACK)."""
    conn = psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        row_factory=dict_row,
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
