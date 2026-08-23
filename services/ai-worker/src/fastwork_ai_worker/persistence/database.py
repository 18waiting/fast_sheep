"""Worker-side SQLite database access (M1).

Clean-room implementation. Derived only from public/project behavioral
specifications and frozen contracts. No migrations, no RPC, no business logic.
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Optional

from .errors import PersistenceError, ERROR_CODES
from .schema import worker_schema_version, SUPPORTED_DB_SCHEMA_VERSION

DB_FILENAME = "fastwork.sqlite3"
DATA_ROOT_ENV = "FASTWORK_DATA_DIR"


def resolve_data_root(override: Optional[str] = None) -> Path:
    chosen = (override or os.environ.get(DATA_ROOT_ENV) or "").strip()
    if not chosen:
        if os.name == "nt":
            base = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
            chosen = str(Path(base) / "FastWorkRebuild" / "data")
        else:
            chosen = str(Path.home() / ".fastwork-rebuild" / "data")
    p = Path(chosen).resolve()
    if not p.is_absolute():
        raise PersistenceError(ERROR_CODES["INVALID_DATA_ROOT"], f"data root must be absolute: {chosen}")
    return p


def open_worker_db(data_root: Optional[str | Path] = None, *, require_schema: bool = True) -> sqlite3.Connection:
    """Open the shared clean-room SQLite database as the worker.

    The worker owns knowledge aggregates and MUST NOT run migrations; it verifies
    the schema version and refuses to write when the schema is missing or newer.
    """
    root = resolve_data_root(str(data_root)) if data_root else resolve_data_root()
    db_path = root / DB_FILENAME
    if not db_path.exists():
        raise PersistenceError(ERROR_CODES["DATABASE_MISSING"], f"database not found: {db_path}")
    conn = sqlite3.connect(str(db_path), timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    version = worker_schema_version(conn)
    if require_schema and version != SUPPORTED_DB_SCHEMA_VERSION():
        conn.close()
        raise PersistenceError(
            ERROR_CODES["WORKER_SCHEMA_UNSUPPORTED"],
            f"worker requires schema version {SUPPORTED_DB_SCHEMA_VERSION()}, database has {version}",
        )
    return conn
