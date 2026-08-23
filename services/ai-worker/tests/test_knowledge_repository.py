"""KnowledgeRepository persistence tests (M1, TASK-016). No embeddings / FAISS / RAG."""
from __future__ import annotations

import sqlite3
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / ".." / "src"))

from fastwork_ai_worker.persistence import KnowledgeRepository  # noqa: E402
from _scaffold import make_migrated_db  # noqa: E402

BASE = {
    "created_at": "2026-08-15T00:00:00Z",
    "updated_at": "2026-08-15T00:00:00Z",
}


class TestKnowledgeRepository(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp, self.conn = make_migrated_db()

    def tearDown(self) -> None:
        self.conn.close()

    def test_insert_get_update_delete(self) -> None:
        repo = KnowledgeRepository(self.conn)
        repo.upsert({"id": "h1", "question": "q", "answer": "a", "product_id": "", "trust_level": "PENDING", **BASE})
        self.assertEqual(repo.count(), 1)
        repo.upsert({"id": "h1", "question": "q2", "answer": "a2", "product_id": "", "trust_level": "PENDING", **BASE})
        self.assertEqual(repo.get("h1")["answer"], "a2")
        repo.delete("h1")
        self.assertEqual(repo.count(), 0)

    def test_trust_validation(self) -> None:
        repo = KnowledgeRepository(self.conn)
        with self.assertRaises(ValueError):
            repo.upsert({"id": "h2", "question": "q", "answer": "a", "product_id": "", "trust_level": "WEIRD", **BASE})

    def test_product_id_round_trips(self) -> None:
        repo = KnowledgeRepository(self.conn)
        repo.upsert({"id": "h3", "question": "q", "answer": "a", "product_id": "", "trust_level": "AUTO", **BASE})
        repo.upsert({"id": "h4", "question": "q", "answer": "a", "product_id": "1", "trust_level": "GENERATED", **BASE})
        self.assertEqual(repo.get("h3")["product_id"], "")
        self.assertEqual(repo.get("h4")["product_id"], "1")

    def test_tags_round_trip_order(self) -> None:
        repo = KnowledgeRepository(self.conn)
        repo.upsert({"id": "h5", "question": "q", "answer": "a", "product_id": "", "tags": ["b", "a", "c"], "trust_level": "PENDING", **BASE})
        self.assertEqual(repo.get("h5")["tags"], ["b", "a", "c"])

    def test_transaction_rollback(self) -> None:
        repo = KnowledgeRepository(self.conn)
        self.conn.execute("BEGIN")
        repo.upsert({"id": "h6", "question": "q", "answer": "a", "product_id": "", "trust_level": "PENDING", **BASE})
        self.conn.rollback()
        self.assertEqual(repo.get("h6"), None)

    def test_close_reopen(self) -> None:
        repo = KnowledgeRepository(self.conn)
        repo.upsert({"id": "h7", "question": "q", "answer": "a", "product_id": "", "trust_level": "PENDING", **BASE})
        self.conn.commit()
        self.conn.close()
        conn2 = sqlite3.connect(str(Path(self.tmp) / "fast_sheep.sqlite3"))
        conn2.row_factory = sqlite3.Row
        self.assertEqual(KnowledgeRepository(conn2).get("h7")["answer"], "a")
        conn2.close()


if __name__ == "__main__":
    unittest.main()


class TestPerformanceSanity(unittest.TestCase):
    def test_1000_knowledge_rows(self) -> None:
        tmp, conn = make_migrated_db()
        repo = KnowledgeRepository(conn)
        import time
        t0 = time.time()
        for i in range(1000):
            repo.upsert({"id": f"h{i}", "question": f"q{i}", "answer": "a", "product_id": "",
                         "trust_level": "GENERATED", "created_at": "t", "updated_at": "t"})
        conn.commit()
        self.assertEqual(repo.count(), 1000)
        self.assertLess(time.time() - t0, 30.0)
        conn.close()
