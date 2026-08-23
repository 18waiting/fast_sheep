"""Shared M1 test scaffolding (clean-room). Migrates a throwaway database by
executing the canonical 0001_initial.sql — the worker itself never runs
authoritative migrations.
"""
from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MIGRATIONS = (HERE / ".." / ".." / ".." / "packages" / "persistence" / "migrations").resolve()


def make_migrated_db() -> tuple[str, sqlite3.Connection]:
    tmp = tempfile.mkdtemp(prefix="fw-py-")
    db_path = Path(tmp) / "fast_sheep.sqlite3"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.executescript((MIGRATIONS / "0001_initial.sql").read_text(encoding="utf-8"))
    conn.executescript((MIGRATIONS / "0002_feedback_effect_tracking.sql").read_text(encoding="utf-8"))
    conn.executescript((MIGRATIONS / "0003_learning_review_audit_optimization.sql").read_text(encoding="utf-8"))
    conn.executescript((MIGRATIONS / "0004_legacy_import_tracking.sql").read_text(encoding="utf-8"))
    conn.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('database_schema_version', '4')")
    conn.commit()
    return tmp, conn
