import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Audit discard (M10): no knowledge write, zero external calls."""
import unittest
from fastwork_ai_worker.audit.audit_engine import AuditEngine


class _Knowledge:
    def __init__(self):
        self.rows = {}

    def upsert(self, row):
        self.rows[row["id"]] = row


class TestAuditDiscard(unittest.TestCase):
    def test_discard_no_knowledge(self):
        k = _Knowledge()
        eng = AuditEngine(knowledge_repo=k)
        res = eng.decide({"action": "丢弃", "entry": {"问题": "q", "答案": "a"}})
        self.assertEqual(len(k.rows), 0)
        self.assertEqual(res["persistence"], [{"aggregate": "knowledge", "op": "none"}])
        self.assertEqual(res["external_calls"], [])


if __name__ == "__main__":
    unittest.main()
