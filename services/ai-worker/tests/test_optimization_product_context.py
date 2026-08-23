import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Optimization product context (M10): product_id normalization."""
import unittest
from fastwork_ai_worker.optimization.product_context import normalize_product_id, product_context


class TestProductContext(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(normalize_product_id(" 10001 "), "10001")
        self.assertEqual(normalize_product_id(""), "")

    def test_context(self):
        c = product_context("10001", {"title": "T", "detail": "D"})
        self.assertEqual(c["product_id"], "10001")
        self.assertEqual(c["title"], "T")


if __name__ == "__main__":
    unittest.main()
