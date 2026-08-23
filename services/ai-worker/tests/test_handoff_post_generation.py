import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Post-generation handoff (M9): engine fires at the post stage."""
import unittest
from fastwork_ai_worker.handoff.handoff_port_adapter import HandoffPortAdapter
from fastwork_ai_worker.handoff.handoff_engine import HandoffPolicyEngine
from fastwork_ai_worker.handoff.clock import FakeClock

class TestPostGeneration(unittest.TestCase):
    def test_post_decision(self):
        adapter = HandoffPortAdapter(HandoffPolicyEngine(), clock=FakeClock(0))
        d = adapter.decide({"stage": "post", "question": "退款", "reply": "", "rules": [{"keyword": "退款", "target": "售后"}]})
        self.assertTrue(d["requested"])
        self.assertEqual(d["target"], "售后")

if __name__ == "__main__":
    unittest.main()
