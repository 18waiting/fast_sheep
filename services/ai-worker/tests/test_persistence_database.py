"""Worker database access tests (M1, TASK-016).

Clean-room implementation. The worker never runs migrations; it verifies the
database schema version and writes only worker-owned knowledge aggregates.
"""
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
    resolve_data_root,
)
from _scaffold import make_migrated_db  # noqa: E402


class TestWorkerDatabase(unittest.TestCase):
    def test_open_worker_db_ok_and_pragmas(self) -> None:
        tmp, seed = make_migrated_db()
        seed.close()
        conn = open_worker_db(tmp)
        self.assertEqual(conn.execute("PRAGMA foreign_keys").fetchone()[0], 1)
        self.assertEqual(conn.execute("PRAGMA busy_timeout").fetchone()[0], 5000)
        self.assertIn(conn.execute("PRAGMA journal_mode").fetchone()[0].lower(), ("wal",))
        conn.close()

    def test_open_worker_db_missing_database(self) -> None:
        tmp = tempfile.mkdtemp(prefix="fw-py-nodb-")
        with self.assertRaises(PersistenceError) as ctx:
            open_worker_db(tmp)
        self.assertEqual(ctx.exception.code, "persistence.database_missing")

    def test_resolve_data_root_absolute(self) -> None:
        tmp = tempfile.mkdtemp(prefix="fw-py-root-")
        self.assertEqual(resolve_data_root(tmp), Path(tmp).resolve())

    def test_worker_boundary_no_main_repositories(self) -> None:
        # The worker persistence package must NOT export product/settings mutation.
        import fastwork_ai_worker.persistence as pkg
        self.assertFalse(hasattr(pkg, "ProductRepository"))
        self.assertFalse(hasattr(pkg, "SettingsRepository"))
        self.assertTrue(hasattr(pkg, "KnowledgeRepository"))


if __name__ == "__main__":
    unittest.main()
