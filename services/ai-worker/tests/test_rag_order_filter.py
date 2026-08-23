"""M3 order filter tests (GF-RAG-ORD-*)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rag.order_filter import filter_results


class TestOrderFilter(unittest.TestCase):
    def test_not_ordered_removes_ordered(self):
        out = filter_results([{"q": "a", "tags": ["#已下单"]}, {"q": "b", "tags": []}], "未下单")
        self.assertEqual([r["q"] for r in out["kept"]], ["b"])

    def test_ordered_removes_not_ordered(self):
        out = filter_results([{"q": "a", "tags": ["#未下单"]}, {"q": "b", "tags": []}], "已下单")
        self.assertEqual([r["q"] for r in out["kept"]], ["b"])

    def test_strict_mode_top10(self):
        results = [{"q": "q%d" % i, "tags": ["#已下单"] if i < 5 else ["#未下单"]} for i in range(10)]
        out = filter_results(results, "未下单")
        self.assertTrue(out["strict_mode"])
        self.assertEqual(out["top_n"], 10)
        self.assertEqual(len(out["kept"]), 5)

    def test_relaxed_branch(self):
        out = filter_results([{"q": "a", "tags": ["#已下单"]}], "未下单")
        self.assertFalse(out["strict_mode"])
        self.assertEqual(out["decision"], "relaxed_branch")


if __name__ == "__main__":
    unittest.main()
