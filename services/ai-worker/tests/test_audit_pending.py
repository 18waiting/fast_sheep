import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Audit pending (M10): keep pending, no knowledge write."""
import unittest
from fastwork_ai_worker.audit.audit_engine import AuditEngine


class _Pending:
    def __init__(self):
        self.rows = []

    def upsert(self, row):
        self.rows.append(row)


class _Knowledge:
    def __init__(self):
        self.rows = {}

    def upsert(self, row):
        self.rows[row["id"]] = row


class TestAuditPending(unittest.TestCase):
    def test_pending_kept(self):
        p = _Pending()
        k = _Knowledge()
        eng = AuditEngine(knowledge_repo=k, pending_repo=p)
        res = eng.decide({"action": "待定", "entry": {"问题": "q", "答案": "a"}})
        self.assertEqual(len(k.rows), 0)
        self.assertEqual(len(p.rows), 1)
        self.assertEqual(res["result"]["统计"]["待定"], 1)


if __name__ == "__main__":
    unittest.main()
