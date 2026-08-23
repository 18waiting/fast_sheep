import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""HandoffPolicyEngine (M9): integration of gates + paths."""
import unittest
from fastwork_ai_worker.handoff.handoff_engine import HandoffPolicyEngine

class TestHandoffEngine(unittest.TestCase):
    def test_first_match_ordering(self):
        d = HandoffPolicyEngine().decide({"rules": [{"keyword": "退款", "target": "A"}, {"keyword": "退款", "target": "B"}], "question": "我要退款"})
        self.assertEqual(d.get("target"), "A")

    def test_no_rules(self):
        d = HandoffPolicyEngine().decide({"rules": [], "question": "在吗"})
        self.assertFalse(d.get("transfer"))

if __name__ == "__main__":
    unittest.main()
