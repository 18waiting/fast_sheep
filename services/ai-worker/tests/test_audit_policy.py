import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Audit policy (M10): 保留/丢弃/待定 -> canonical effect."""
import unittest
from fastwork_ai_worker.audit.audit_policy import decide_effect, is_human_action


class TestAuditPolicy(unittest.TestCase):
    def test_approve_effect(self):
        e = decide_effect("保留", {"问题": "q", "答案": "a", "商品ID": "10001"})
        self.assertEqual(e["knowledge_op"], "commit")
        self.assertEqual(e["trust"], "HUMAN_CONFIRMED")
        self.assertEqual(e["index_refresh"], "incremental")

    def test_empty_product_fallback(self):
        e = decide_effect("保留", {"问题": "q", "答案": "a", "商品ID": ""})
        self.assertEqual(e["product_id"], "1")

    def test_discard_no_write(self):
        e = decide_effect("丢弃", {})
        self.assertEqual(e["knowledge_op"], "none")

    def test_pending_keep(self):
        e = decide_effect("待定", {})
        self.assertTrue(e["keep_pending"])

    def test_human_actions(self):
        for a in ("保留", "丢弃", "待定"):
            self.assertTrue(is_human_action(a))
        self.assertFalse(is_human_action("delete_all"))


if __name__ == "__main__":
    unittest.main()
