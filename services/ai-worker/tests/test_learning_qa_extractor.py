import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning QA extractor (M10): [买家]/[客服] -> QA pairs; exclusions."""
import unittest
from fastwork_ai_worker.learning.conversation_qa_extractor import extract_qa


class TestQaExtractor(unittest.TestCase):
    def test_basic_pairs(self):
        qa, excluded = extract_qa("[买家]这个多少钱\n[客服]99元")
        self.assertEqual(qa, [{"问题": "这个多少钱", "答案": "99元"}])
        self.assertEqual(excluded, [])

    def test_short_question_excluded(self):
        qa, excluded = extract_qa("[买家]在\n[客服]好的", min_chars=5)
        self.assertEqual(qa, [])
        self.assertEqual(excluded, ["在"])

    def test_image_placeholder_excluded(self):
        qa, excluded = extract_qa("[买家]【图片消息】【图片消息，】\n[客服]看图")
        self.assertEqual(qa, [])
        self.assertIn("【图片消息】【图片消息，】", excluded)


if __name__ == "__main__":
    unittest.main()
