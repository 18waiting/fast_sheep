import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Audit idempotency (M10): repeated approve does not duplicate knowledge."""
import unittest
from fastwork_ai_worker.audit.audit_engine import AuditEngine


class _Knowledge:
    def __init__(self):
        self.rows = {}

    def upsert(self, row):
        self.rows[row["id"]] = row


class _Candidates:
    def __init__(self):
        self.statuses = []

    def update_status(self, cid, status):
        self.statuses.append((cid, status))


class TestAuditIdempotency(unittest.TestCase):
    def test_repeat_approve_single_effect(self):
        k = _Knowledge()
        c = _Candidates()
        eng = AuditEngine(knowledge_repo=k, candidate_repo=c)
        entry = {"问题": "q", "答案": "a", "商品ID": "10001"}
        eng.decide({"action": "保留", "entry": entry})
        eng.decide({"action": "保留", "entry": entry})
        # same content -> same entry id -> single logical row via upsert
        self.assertEqual(len(k.rows), 1)
        self.assertTrue(any(status == "FINALIZED" for _, status in c.statuses))


if __name__ == "__main__":
    unittest.main()
