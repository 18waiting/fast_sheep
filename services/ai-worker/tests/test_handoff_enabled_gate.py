import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Enabled/status gate (M9): disabled rules never fire."""
import unittest
from fastwork_ai_worker.handoff.handoff_engine import HandoffPolicyEngine

class TestEnabledGate(unittest.TestCase):
    def test_disabled_rule_skipped(self):
        engine = HandoffPolicyEngine()
        d = engine.decide({"rules": [{"keyword": "退款", "target": "售后", "status": "禁用"}], "question": "退款"})
        self.assertFalse(d.get("transfer"))

    def test_any_message_disabled_skipped(self):
        engine = HandoffPolicyEngine()
        d = engine.decide({"rules": [{"keyword": "【任何消息都转接】", "target": "值班", "enabled": False}], "question": "在吗"})
        self.assertFalse(d.get("transfer"))

if __name__ == "__main__":
    unittest.main()
