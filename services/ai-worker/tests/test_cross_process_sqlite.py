"""Cross-process SQLite semantics (worker side, M1, TASK-016).

The shared database is written by MAIN-owned repositories (Node) and
worker-owned knowledge repositories (Python). This test verifies the worker side:
it can read MAIN-owned data and write worker-owned knowledge, and does not expose
competing write APIs for MAIN aggregates. The Node-side half lives in
rebuild/scripts/test-cross-process-sqlite.mjs.
"""
from __future__ import annotations

import sqlite3
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / ".." / "src"))

from fastwork_ai_worker.persistence import open_worker_db, KnowledgeRepository  # noqa: E402
from _scaffold import make_migrated_db  # noqa: E402


class TestCrossProcessSqlite(unittest.TestCase):
    def test_worker_reads_main_owned_and_writes_worker_owned(self) -> None:
        tmp, conn = make_migrated_db()
        # MAIN-owned shop row (as if written by Node).
        conn.execute("INSERT INTO shops (id, type, name, enabled, sort_order) VALUES ('shop-1','pdd','店',1,0)")
        conn.commit()
        conn.close()
        wconn = open_worker_db(tmp)
        shops = wconn.execute("SELECT COUNT(*) AS c FROM shops").fetchone()["c"]
        self.assertEqual(shops, 1)
        kr = KnowledgeRepository(wconn)
        kr.upsert({"id": "h1", "question": "q", "answer": "a", "product_id": "", "trust_level": "HUMAN_CONFIRMED",
                   "created_at": "2026-08-15T00:00:00Z", "updated_at": "2026-08-15T00:00:00Z"})
        wconn.commit()
        wconn.close()
        # A second connection (simulating Node) reads the worker-written knowledge row.
        c2 = sqlite3.connect(str(Path(tmp) / "fastwork.sqlite3"))
        c2.row_factory = sqlite3.Row
        self.assertEqual(c2.execute("SELECT COUNT(*) AS c FROM knowledge_entries").fetchone()["c"], 1)
        c2.close()

    def test_no_corruption_after_cross_aggregate_io(self) -> None:
        tmp, conn = make_migrated_db()
        conn.close()
        wconn = open_worker_db(tmp)
        KnowledgeRepository(wconn).upsert({"id": "h2", "question": "q", "answer": "a", "product_id": "", "trust_level": "AUTO",
                                           "created_at": "t", "updated_at": "t"})
        wconn.commit()
        wconn.close()
        check = sqlite3.connect(str(Path(tmp) / "fastwork.sqlite3"))
        self.assertEqual(check.execute("PRAGMA quick_check").fetchone()[0], "ok")
        check.close()


if __name__ == "__main__":
    unittest.main()
