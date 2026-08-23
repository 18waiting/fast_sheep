import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Qianniu early handoff (M9): config-driven pre-AI boundary."""
import unittest
from fastwork_ai_worker.handoff.handoff_port_adapter import HandoffPortAdapter

class TestQianniuEarly(unittest.TestCase):
    def test_early_trigger(self):
        adapter = HandoffPortAdapter()
        d = adapter.decide({"stage": "early", "question": "咨询商品【手机】", "qianniu_config": {"enabled": True, "trigger_words": ["咨询商品【"], "target": "人工"}})
        self.assertTrue(d["requested"])
        self.assertEqual(d["target"], "人工")

    def test_early_disabled(self):
        adapter = HandoffPortAdapter()
        d = adapter.decide({"stage": "early", "question": "咨询商品【手机】", "qianniu_config": {"enabled": False}})
        self.assertIsNone(d)

if __name__ == "__main__":
    unittest.main()
