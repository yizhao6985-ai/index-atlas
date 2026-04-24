from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row

from app.config import settings


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(settings.database_url, row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def exec_sql(conn: psycopg.Connection, sql: str, params: tuple | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
