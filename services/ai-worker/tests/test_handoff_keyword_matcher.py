import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Literal keyword matcher (M9): substring containment."""
import unittest
from fastwork_ai_worker.handoff.keyword_matcher import match_keywords

class TestKeywordMatcher(unittest.TestCase):
    def test_substring_match(self):
        self.assertEqual(match_keywords("退款,退换", "我要退换货"), "退换")

    def test_no_match(self):
        self.assertIsNone(match_keywords("退款", "在吗"))

    def test_pseudo_not_literal(self):
        self.assertIsNone(match_keywords("【已下单】", "【已下单】"))

if __name__ == "__main__":
    unittest.main()
