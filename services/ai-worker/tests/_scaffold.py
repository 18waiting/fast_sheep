"""Shared M1 test scaffolding (clean-room). Migrates a throwaway database by
executing the canonical migration files — the worker itself never runs
authoritative migrations.
"""
from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MIGRATIONS = (HERE / ".." / ".." / ".." / "packages" / "persistence" / "migrations").resolve()

_CANONICAL = [
    "0001_initial.sql",
    "0002_feedback_effect_tracking.sql",
    "0003_learning_review_audit_optimization.sql",
    "0004_legacy_import_tracking.sql",
    "0005_identity_domain.sql",
    "0006_conversation_domain.sql",
    "0007_commerce_domain.sql",
]


def make_migrated_db() -> tuple[str, sqlite3.Connection]:
    tmp = tempfile.mkdtemp(prefix="fw-py-")
    db_path = Path(tmp) / "fast_sheep.sqlite3"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    for name in _CANONICAL:
        conn.executescript((MIGRATIONS / name).read_text(encoding="utf-8"))
    conn.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('database_schema_version', '7')")
    conn.commit()
    return tmp, conn