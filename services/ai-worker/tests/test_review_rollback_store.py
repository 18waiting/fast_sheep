import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Review rollback store (M10): durable snapshots."""
import unittest
import sqlite3
import tempfile
import os
from fastwork_ai_worker.review.rollback_store import RollbackStore


class TestRollbackStore(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="fw-rb-")
        self.conn = sqlite3.connect(os.path.join(self.dir, "t.db"))
        self.conn.execute("CREATE TABLE review_rollbacks (id TEXT PRIMARY KEY, entry_id TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL)")

    def tearDown(self):
        self.conn.close()

    def test_snapshot_and_get(self):
        store = RollbackStore(self.conn)
        rid = store.snapshot("h1", {"问题": "q", "答案": "a"})
        self.assertTrue(rid.startswith("rb-"))
        got = store.get("h1")
        self.assertEqual(got["问题"], "q")


if __name__ == "__main__":
    unittest.main()
