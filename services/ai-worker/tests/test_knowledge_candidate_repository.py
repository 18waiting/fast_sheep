"""KnowledgeCandidateRepository persistence tests (M1, TASK-016). No review/audit algorithms."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / ".." / "src"))

from fastwork_ai_worker.persistence import KnowledgeCandidateRepository  # noqa: E402
from _scaffold import make_migrated_db  # noqa: E402


class TestKnowledgeCandidateRepository(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp, self.conn = make_migrated_db()

    def tearDown(self) -> None:
        self.conn.close()

    def test_crud_and_status(self) -> None:
        repo = KnowledgeCandidateRepository(self.conn)
        repo.insert({"candidate_id": "c1", "question": "有货吗", "answer": "有", "product_id": "10001", "origin": "GENERATED", "status": "PENDING_REVIEW"})
        self.assertEqual(repo.count(), 1)
        self.assertEqual(len(repo.list_pending()), 1)
        repo.update_status("c1", "APPROVED")
        self.assertEqual(repo.get("c1")["status"], "APPROVED")
        self.assertEqual(len(repo.list_pending()), 0)
        repo.delete("c1")
        self.assertEqual(repo.count(), 0)

    def test_origin_validation(self) -> None:
        repo = KnowledgeCandidateRepository(self.conn)
        with self.assertRaises(ValueError):
            repo.insert({"candidate_id": "c2", "question": "q", "answer": "a", "product_id": "", "origin": "NOPE"})


if __name__ == "__main__":
    unittest.main()
