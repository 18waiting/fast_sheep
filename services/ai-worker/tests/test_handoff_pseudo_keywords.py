import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Pseudo-keyword matcher (M9): supported set only."""
import unittest
from fastwork_ai_worker.handoff.pseudo_keyword_matcher import match_pseudo_keyword
from fastwork_ai_worker.handoff.types import EvaluationContext

class TestPseudoKeywords(unittest.TestCase):
    def test_any(self):
        self.assertEqual(match_pseudo_keyword("【任何消息都转接】", EvaluationContext(question="在吗"))["reason"], "any")

    def test_phone(self):
        self.assertEqual(match_pseudo_keyword("【手机号】", EvaluationContext(question="电话13812345678"))["reason"], "phone")

    def test_ordered(self):
        self.assertEqual(match_pseudo_keyword("【已下单】", EvaluationContext(order_state="已下单"))["reason"], "ordered")

    def test_similarity_lt_boundary(self):
        self.assertEqual(match_pseudo_keyword("【相似度小于0.6】", EvaluationContext(highest_sim=0.599))["reason"], "similarity_lt")
        self.assertIsNotNone(match_pseudo_keyword("【相似度小于0.6】", EvaluationContext(highest_sim=0.6)).get("operator"))

    def test_unknown_no_silent(self):
        self.assertIsNone(match_pseudo_keyword("【未知】", EvaluationContext(question="x")))

if __name__ == "__main__":
    unittest.main()
