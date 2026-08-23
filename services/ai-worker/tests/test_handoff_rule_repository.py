import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Rule repository (M9): read-only load from transfer_rules rows."""
import unittest
from fastwork_ai_worker.handoff.rule_repository import RuleRepository

class TestRuleRepository(unittest.TestCase):
    def test_load_csv_rows(self):
        rules = RuleRepository(None).load_csv_rows([{"keyword": "退款", "转接到": "售后", "状态": "生效"}])
        self.assertEqual(rules[0].keyword, "退款")
        self.assertEqual(rules[0].transfer_to, "售后")
        self.assertEqual(rules[0].status, "生效")

if __name__ == "__main__":
    unittest.main()
