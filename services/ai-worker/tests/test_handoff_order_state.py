import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Order-state gate (M9): 生效下单状态 containment."""
import unittest
from fastwork_ai_worker.handoff.handoff_engine import HandoffPolicyEngine

class TestOrderState(unittest.TestCase):
    def test_order_gate_blocks(self):
        d = HandoffPolicyEngine().decide({"rules": [{"keyword": "退款", "target": "售后", "order_state": "已下单"}], "question": "退款", "order_state": "未下单"})
        self.assertFalse(d.get("transfer"))
        self.assertEqual(d.get("reason"), "order_gate")

    def test_order_allowed(self):
        d = HandoffPolicyEngine().decide({"rules": [{"keyword": "退款", "target": "售后", "order_state": "已下单"}], "question": "退款", "order_state": "已下单"})
        self.assertTrue(d.get("transfer"))

if __name__ == "__main__":
    unittest.main()
