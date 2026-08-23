import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning refiner (M10): mock QA generation + fallback + provider error."""
import unittest
from fastwork_ai_worker.learning.candidate_refiner import generate_qa
from fastwork_ai_worker.learning.errors import LearningError


class _QaProvider:
    def __init__(self, mock=None, error=None):
        self.mock = mock or {}
        self.error = error

    def generate(self, request):
        if self.error:
            return {"error": {"message": self.error}}
        return dict(self.mock)


class TestRefiner(unittest.TestCase):
    def test_generated_qa_strips_tag(self):
        p = _QaProvider({"qa": [{"q": "<标签>有XL吗", "a": "有的"}]})
        qa = generate_qa({"content": "[买家]有XL吗\n[客服]有的"}, p)
        self.assertEqual(qa, [{"问题": "有XL吗", "答案": "有的"}])

    def test_fallback_to_parsed(self):
        p = _QaProvider({})
        qa = generate_qa({"content": "[买家]这个多少钱\n[客服]99元"}, p)
        self.assertEqual(qa, [{"问题": "这个多少钱", "答案": "99元"}])

    def test_provider_error_raises(self):
        p = _QaProvider(error="provider_failure")
        with self.assertRaises(LearningError):
            generate_qa({"content": "x"}, p)


if __name__ == "__main__":
    unittest.main()
