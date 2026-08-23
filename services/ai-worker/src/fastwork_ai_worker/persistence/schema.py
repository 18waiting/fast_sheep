"""Worker-supported DB schema version (M1).

Clean-room implementation. The worker NEVER runs authoritative migrations; it
verifies the database schema version before writing.
"""
from __future__ import annotations

import sqlite3
from typing import Optional


def SUPPORTED_DB_SCHEMA_VERSION() -> int:
    # M1 (0001) + M9 (0002) + M10 (0003) + M11 legacy import tracking (0004). Worker never runs migrations.
    return 4


def worker_schema_version(conn: sqlite3.Connection) -> int:
    try:
        row = conn.execute("SELECT value FROM app_meta WHERE key = 'database_schema_version'").fetchone()
        return int(row[0]) if row else 0
    except sqlite3.Error:
        return 0


def is_schema_supported(version: int) -> bool:
    return version == SUPPORTED_DB_SCHEMA_VERSION()
