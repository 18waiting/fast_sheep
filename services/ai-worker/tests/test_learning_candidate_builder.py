import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning candidate builder (M10): dedup + frequency grouping surface."""
import unittest
from fastwork_ai_worker.learning.candidate_deduplicator import dedup_qa
from fastwork_ai_worker.learning.candidate_frequency import frequency_groups


class _Emb:
    def embed(self, texts):
        return [[1.0, 0.0], [0.9, 0.4359], [0.85, 0.5268]][: len(texts)]


class TestCandidateBuilder(unittest.TestCase):
    def test_dedup(self):
        qa = [{"问题": "q", "答案": "a"}, {"问题": "q", "答案": "a"}, {"问题": "q2", "答案": "a2"}]
        self.assertEqual(len(dedup_qa(qa)), 2)

    def test_frequency_empty(self):
        self.assertEqual(frequency_groups([], _Emb(), 0.9)["groups"], 0)

    def test_frequency_single(self):
        r = frequency_groups(["q"], _Emb(), 0.9)
        self.assertEqual(r["groups"], 1)


if __name__ == "__main__":
    unittest.main()
