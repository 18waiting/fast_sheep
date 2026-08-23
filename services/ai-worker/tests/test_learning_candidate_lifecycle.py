import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning candidate lifecycle (M10): pending -> candidate."""
import unittest
from fastwork_ai_worker.learning.candidate_lifecycle import CandidateLifecycle


class _Pending:
    def __init__(self):
        self.rows = []

    def upsert(self, row):
        self.rows.append(row)


class _Candidates:
    def __init__(self):
        self.rows = []

    def insert(self, row):
        self.rows.append(row)


class TestCandidateLifecycle(unittest.TestCase):
    def test_insert_pending_counts(self):
        p = _Pending()
        lc = CandidateLifecycle(_Candidates(), p)
        n = lc.insert_pending([{"问题": "q", "答案": "a"}, {"问题": "q2", "答案": "a2"}], "b1", "10001")
        self.assertEqual(n, 2)
        self.assertEqual(len(p.rows), 2)

    def test_to_candidate_origin(self):
        c = _Candidates()
        lc = CandidateLifecycle(c, _Pending())
        cid = lc.to_candidate({"id": "p-1", "question": "q", "answer": "a", "product_id": "1"}, "GENERATED")
        self.assertTrue(cid.startswith("c-"))
        self.assertEqual(c.rows[0]["origin"], "GENERATED")
        self.assertEqual(c.rows[0]["status"], "PENDING_REVIEW")


if __name__ == "__main__":
    unittest.main()
