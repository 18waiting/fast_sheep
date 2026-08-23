import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Review restore (M10): idempotent A-library append + AUTO trust."""
import unittest
from fastwork_ai_worker.review.review_restore import restore_entry


class _Knowledge:
    def __init__(self):
        self.rows = {}

    def get(self, entry_id):
        return self.rows.get(entry_id)

    def upsert(self, row):
        self.rows[row["id"]] = row


class TestReviewRestore(unittest.TestCase):
    def test_restore_appends_auto(self):
        k = _Knowledge()
        r = restore_entry(k, {"商品ID": "10001", "问题": "q", "答案": "a"})
        self.assertTrue(r["applied"])
        self.assertEqual(r["trust"], "AUTO")
        row = list(k.rows.values())[0]
        self.assertEqual(row["trust_level"], "AUTO")
        self.assertIn("审查恢复", row["tags"])

    def test_restore_idempotent(self):
        k = _Knowledge()
        restore_entry(k, {"商品ID": "10001", "问题": "q", "答案": "a"})
        r2 = restore_entry(k, {"商品ID": "10001", "问题": "q", "答案": "a"})
        self.assertFalse(r2["applied"])
        self.assertEqual(len(k.rows), 1)


if __name__ == "__main__":
    unittest.main()
