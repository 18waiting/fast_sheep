"""M3 fast-return tests (GF-RAG-FR-*)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rag.fast_return import completed_fast_return, product_fast_return


class TestFastReturn(unittest.TestCase):
    def test_product_exactly_09_not_triggered(self):
        self.assertEqual(product_fast_return(0.9, {"product_fast_return_threshold": 0.9}), {"fast_return": False, "operator": "gt"})

    def test_product_above_09_triggered(self):
        self.assertEqual(product_fast_return(0.9001, {"product_fast_return_threshold": 0.9}), {"fast_return": True})

    def test_completed_len_diff_boundary(self):
        self.assertEqual(
            completed_fast_return(0.95, 3, {"completed_fast_return_sim": 0.9, "completed_fast_return_len_diff": 3}),
            {"fast_return": True, "len_diff_ok": True, "operator": "lte"},
        )

    def test_completed_len_diff_exceeded(self):
        self.assertEqual(
            completed_fast_return(0.95, 4, {"completed_fast_return_sim": 0.9, "completed_fast_return_len_diff": 3}),
            {"fast_return": False, "reason": "len_diff_exceeded"},
        )

    def test_completed_sim_below_threshold(self):
        self.assertEqual(
            completed_fast_return(0.89, 1, {"completed_fast_return_sim": 0.9, "completed_fast_return_len_diff": 3}),
            {"fast_return": False, "reason": "similarity_below_threshold"},
        )


if __name__ == "__main__":
    unittest.main()
