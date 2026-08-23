import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Xianyu skip (M9): no executable auto-transfer decision."""
import unittest
from fastwork_ai_worker.handoff.handoff_engine import HandoffPolicyEngine

class TestXianyuSkip(unittest.TestCase):
    def test_skip(self):
        d = HandoffPolicyEngine().decide({"rules": [{"keyword": "退款", "target": "售后"}], "question": "退款", "agent": "闲鱼-小店"})
        self.assertFalse(d.get("transfer"))
        self.assertEqual(d.get("reason"), "xianyu_excluded")

if __name__ == "__main__":
    unittest.main()
