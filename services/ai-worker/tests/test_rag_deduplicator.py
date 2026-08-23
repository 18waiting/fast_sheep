"""M3 deduplicator tests (GF-RAG-DEDUP-*)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rag.deduplicator import dedupe


class TestDeduplicator(unittest.TestCase):
    def test_same_qa_deduped(self):
        results = [{"q": "a", "ans": "x", "src": "s1"}, {"q": "a", "ans": "x", "src": "s1"}]
        self.assertEqual(len(dedupe(results)), 1)

    def test_same_question_different_answer_max3(self):
        results = [{"q": "a", "ans": x} for x in ["x", "y", "z", "w"]]
        self.assertEqual(len(dedupe(results)), 3)

    def test_different_question_same_answer_kept(self):
        results = [{"q": "a", "ans": "x"}, {"q": "b", "ans": "x"}]
        self.assertEqual(len(dedupe(results)), 2)


if __name__ == "__main__":
    unittest.main()
