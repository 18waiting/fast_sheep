import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Review idempotency (M10): repeated restore produces a single logical row."""
import unittest
from fastwork_ai_worker.review.review_restore import restore_entry


class _Knowledge:
    def __init__(self):
        self.rows = {}

    def get(self, entry_id):
        return self.rows.get(entry_id)

    def upsert(self, row):
        self.rows[row["id"]] = row


class TestReviewIdempotency(unittest.TestCase):
    def test_double_restore_single_effect(self):
        k = _Knowledge()
        restore_entry(k, {"商品ID": "10001", "问题": "q", "答案": "a"})
        restore_entry(k, {"商品ID": "10001", "问题": "q", "答案": "a"})
        self.assertEqual(len(k.rows), 1)
        self.assertEqual(len([r for r in k.rows.values() if r["trust_level"] == "AUTO"]), 1)


if __name__ == "__main__":
    unittest.main()
