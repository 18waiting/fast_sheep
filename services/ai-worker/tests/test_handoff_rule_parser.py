import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Rule parser (M9): keyword/target splitting + normalization."""
import unittest
from fastwork_ai_worker.handoff.rule_parser import split_keywords, split_targets
from fastwork_ai_worker.handoff.rule_model import parse_rule

class TestRuleParser(unittest.TestCase):
    def test_split_keywords(self):
        self.assertEqual(split_keywords("退款,退换"), ["退款", "退换"])
        self.assertEqual(split_keywords("退款，退换"), ["退款", "退换"])
        self.assertEqual(split_keywords("A&B"), ["A", "B"])

    def test_split_targets(self):
        self.assertEqual(split_targets("A&B"), ["A", "B"])

    def test_parse_rule_target_alias(self):
        r = parse_rule({"keyword": "退款", "target": "售后"})
        self.assertEqual(r.transfer_to, "售后")

if __name__ == "__main__":
    unittest.main()
