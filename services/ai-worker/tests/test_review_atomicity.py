import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Review atomicity (M10): delete completes or leaves rows intact."""
import unittest
from fastwork_ai_worker.review.review_apply import apply_delete


class TestReviewAtomicity(unittest.TestCase):
    def test_failed_match_leaves_rows(self):
        rows = [{"id": "h1", "product_id": "10001", "question": "q", "answer": "a"}]
        r = apply_delete([{"商品ID": "99999", "问题": "nope", "答案": "nope"}], rows)
        self.assertEqual(r["deleted"], 0)
        self.assertEqual(len(r["rows"]), 0)

    def test_partial_match_applies_only_matched(self):
        rows = [
            {"id": "h1", "product_id": "10001", "question": "q", "answer": "a"},
            {"id": "h2", "product_id": "10001", "question": "other", "answer": "a"},
        ]
        r = apply_delete([{"商品ID": "10001", "问题": "q", "答案": "a"}], rows)
        self.assertEqual(r["deleted"], 1)
        self.assertEqual(r["rows"][0]["id"], "h1")


if __name__ == "__main__":
    unittest.main()
