import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning deduplicator (M10): exact (问题,答案) key."""
import unittest
from fastwork_ai_worker.learning.candidate_deduplicator import dedup_qa


class TestDedup(unittest.TestCase):
    def test_removes_exact_duplicates(self):
        out = dedup_qa([{"问题": "q", "答案": "a"}, {"问题": "q", "答案": "a"}])
        self.assertEqual(len(out), 1)

    def test_keeps_distinct(self):
        out = dedup_qa([{"问题": "q", "答案": "a"}, {"问题": "q", "答案": "b"}])
        self.assertEqual(len(out), 2)

    def test_skips_empty(self):
        out = dedup_qa([{"问题": "", "答案": ""}])
        self.assertEqual(len(out), 0)


if __name__ == "__main__":
    unittest.main()
