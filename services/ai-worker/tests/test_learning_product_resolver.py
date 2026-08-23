import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning product resolver (M10)."""
import unittest
from fastwork_ai_worker.learning.product_resolver import resolve_products


class TestProductResolver(unittest.TestCase):
    def test_extracts_product_id(self):
        self.assertEqual(resolve_products("===商品id10001===\n[买家]这个多少钱\n[客服]99元"), ["10001"])

    def test_empty_chat(self):
        self.assertEqual(resolve_products(""), [])

    def test_multiple_dedup(self):
        self.assertEqual(resolve_products("===商品id1===\n===商品id2===\n===商品id1==="), ["1", "2"])


if __name__ == "__main__":
    unittest.main()
