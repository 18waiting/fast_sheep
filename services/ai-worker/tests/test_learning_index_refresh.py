import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning index refresh policy (M10): mutation -> refresh gate."""
import unittest
from fastwork_ai_worker.learning.index_refresh import index_signal, refresh_for


class TestIndexRefresh(unittest.TestCase):
    def test_append_incremental(self):
        self.assertEqual(index_signal("append", 5)["refresh"], "incremental")

    def test_kb_delete_full(self):
        self.assertEqual(index_signal("kb_delete")["refresh"], "full")

    def test_review_delete_precise(self):
        r = index_signal("review_delete", entry_id="h1")
        self.assertEqual(r["refresh"], "precise_delete")
        self.assertEqual(r["entry_id"], "h1")

    def test_precise_failure_fallback(self):
        self.assertEqual(index_signal("review_delete", precise_delete_error=True)["refresh"], "full_fallback")

    def test_append_zero_none(self):
        self.assertEqual(index_signal("append", 0)["refresh"], "none")


if __name__ == "__main__":
    unittest.main()
