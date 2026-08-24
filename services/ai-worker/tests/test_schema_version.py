"""Worker schema-version guard tests (M1, TASK-016)."""
from __future__ import annotations

import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / ".." / "src"))

from fastwork_ai_worker.persistence import (  # noqa: E402
    PersistenceError,
    open_worker_db,
    worker_schema_version,
    is_schema_supported,
    SUPPORTED_DB_SCHEMA_VERSION,
)
from _scaffold import make_migrated_db  # noqa: E402


class TestSchemaVersion(unittest.TestCase):
    def test_supported(self) -> None:
        self.assertEqual(SUPPORTED_DB_SCHEMA_VERSION(), 5)
        self.assertTrue(is_schema_supported(5))
        self.assertFalse(is_schema_supported(4))

    def test_worker_schema_version_reads_app_meta(self) -> None:
        tmp, conn = make_migrated_db()
        self.assertEqual(worker_schema_version(conn), 5)
        conn.close()

    def test_unsupported_schema_rejected(self) -> None:
        tmp, conn = make_migrated_db()
        conn.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('database_schema_version', '99')")
        conn.commit()
        conn.close()
        with self.assertRaises(PersistenceError) as ctx:
            open_worker_db(tmp)
        self.assertEqual(ctx.exception.code, "persistence.worker_schema_unsupported")


if __name__ == "__main__":
    unittest.main()
