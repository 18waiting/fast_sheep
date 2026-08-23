import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Audit approve (M10): commit HUMAN_CONFIRMED + incremental refresh."""
import unittest
from fastwork_ai_worker.audit.audit_engine import AuditEngine


class _Knowledge:
    def __init__(self):
        self.rows = {}

    def upsert(self, row):
        self.rows[row["id"]] = row


class _Index:
    def __init__(self):
        self.modes = []

    def refresh(self, mode):
        self.modes.append(mode)


class TestAuditApprove(unittest.TestCase):
    def test_approve_commits(self):
        k = _Knowledge()
        idx = _Index()
        eng = AuditEngine(knowledge_repo=k, index_refresh=idx)
        res = eng.decide({"action": "保留", "entry": {"问题": "q", "答案": "a", "商品ID": "10001"}})
        self.assertEqual(len(k.rows), 1)
        self.assertEqual(k.rows[list(k.rows)[0]]["trust_level"], "HUMAN_CONFIRMED")
        self.assertEqual(idx.modes, ["incremental"])
        self.assertEqual(res["result"]["统计"]["保留"], 1)


if __name__ == "__main__":
    unittest.main()
