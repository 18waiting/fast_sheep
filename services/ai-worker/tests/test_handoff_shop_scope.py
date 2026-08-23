import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Shop scope gate (M9): applicable_shops containment."""
import unittest
from fastwork_ai_worker.handoff.handoff_engine import HandoffPolicyEngine

class TestShopScope(unittest.TestCase):
    def test_shop_gate_blocks(self):
        d = HandoffPolicyEngine().decide({"rules": [{"keyword": "退款", "target": "售后", "applicable_shops": "pdd"}], "question": "退款", "shop": "jd-店"})
        self.assertFalse(d.get("transfer"))
        self.assertEqual(d.get("reason"), "shop_gate")

    def test_shop_allowed(self):
        d = HandoffPolicyEngine().decide({"rules": [{"keyword": "退款", "target": "售后", "applicable_shops": "pdd"}], "question": "退款", "shop": "pdd"})
        self.assertTrue(d.get("transfer"))

if __name__ == "__main__":
    unittest.main()
