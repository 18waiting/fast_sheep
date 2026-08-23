import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Source-agent gate (M9): containment."""
import unittest
from fastwork_ai_worker.handoff.handoff_engine import HandoffPolicyEngine

class TestSourceAgent(unittest.TestCase):
    def test_contained_pass(self):
        d = HandoffPolicyEngine().decide({"rules": [{"keyword": "退款", "target": "售后", "source_agent": "客服1"}], "question": "退款", "agent": "pdd-客服1"})
        self.assertTrue(d.get("transfer"))
        self.assertEqual(d.get("reason"), "source_agent_contained")

    def test_not_contained_blocked(self):
        d = HandoffPolicyEngine().decide({"rules": [{"keyword": "退款", "target": "售后", "source_agent": "客服9"}], "question": "退款", "agent": "pdd-客服1"})
        self.assertFalse(d.get("transfer"))

if __name__ == "__main__":
    unittest.main()
