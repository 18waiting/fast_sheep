import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Review apply (M10): triple-match delete."""
import unittest
from fastwork_ai_worker.review.review_apply import triple_match, apply_delete


class TestReviewApply(unittest.TestCase):
    def test_triple_match(self):
        row = {"id": "h1", "product_id": "10001", "question": "q", "answer": "a"}
        self.assertTrue(triple_match(row, {"商品ID": "10001", "问题": "q", "答案": "a"}))

    def test_apply_delete(self):
        rows = [{"id": "h1", "product_id": "10001", "question": "q", "answer": "a"}]
        r = apply_delete([{"商品ID": "10001", "问题": "q", "答案": "a"}], rows)
        self.assertEqual(r["deleted"], 1)

    def test_protected_no_delete(self):
        r = apply_delete([{"商品ID": "10001", "问题": "q", "答案": "a"}], [], protected=True)
        self.assertEqual(r["deleted"], 0)
        self.assertTrue(r["protected"])


if __name__ == "__main__":
    unittest.main()
