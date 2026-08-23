import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Audit feedback reuse (M10): approve maps through M9 AUDIT_APPROVE effect."""
import unittest
from fastwork_ai_worker.feedback.effect_mapper import map_effect
from fastwork_ai_worker.feedback.types import FeedbackApplyRequest
from fastwork_ai_worker.audit.audit_engine import AuditEngine


class _Knowledge:
    def __init__(self):
        self.rows = {}

    def upsert(self, row):
        self.rows[row["id"]] = row


class TestAuditFeedbackReuse(unittest.TestCase):
    def test_m9_effect_reused(self):
        req = FeedbackApplyRequest(record_id="r", class_name="AUDIT_APPROVE", question="q", answer="a", product_id="10001")
        effect = map_effect(req)
        self.assertEqual((effect.op, effect.trust, effect.index_refresh), ("insert", "HUMAN_CONFIRMED", "incremental"))

    def test_approve_uses_audit_approve(self):
        k = _Knowledge()
        eng = AuditEngine(knowledge_repo=k)
        res = eng.decide({"action": "保留", "entry": {"问题": "q", "答案": "a", "商品ID": "10001"}})
        self.assertIn({"aggregate": "knowledge", "op": "commit", "trust": "HUMAN_CONFIRMED", "product_id": "10001"}, res["persistence"])


if __name__ == "__main__":
    unittest.main()
