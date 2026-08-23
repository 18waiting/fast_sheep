import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""FC transfer precedence (M9): early > tool > post ordering is caller-owned;
the engine is the post-generation decision."""
import unittest
from fastwork_ai_worker.handoff.handoff_engine import HandoffPolicyEngine

class TestFcPrecedence(unittest.TestCase):
    def test_post_generation_runs_after_tool(self):
        # The engine evaluates post-generation rules; tool-requested transfer is a
        # separate M4 mechanism that precedes this stage.
        d = HandoffPolicyEngine().decide({"rules": [{"keyword": "退款", "target": "售后"}], "question": "退款"})
        self.assertTrue(d.get("transfer"))

if __name__ == "__main__":
    unittest.main()
