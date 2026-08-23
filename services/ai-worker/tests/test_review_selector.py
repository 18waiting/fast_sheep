import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Review selector (M10): whitelist / B-dedup / cold-start."""
import unittest
from fastwork_ai_worker.review.review_selector import filter_whitelist, dedup_against_b, cold_start_protected


class TestReviewSelector(unittest.TestCase):
    def test_whitelist(self):
        cands = [{"问题": "q", "答案": "a", "来源": "A库全自动收录"}, {"问题": "q2", "答案": "a2", "来源": "手工库"}]
        kept = filter_whitelist(cands, ["A库全自动收录", "一键生成问答对结果", "A1自动审核过", "A2自动审核过"])
        self.assertEqual(len(kept), 1)
        self.assertEqual(kept[0]["来源"], "A库全自动收录")

    def test_b_dedup(self):
        cands = [{"问题": "q", "答案": "a"}]
        self.assertEqual(dedup_against_b(cands, [{"问题": "q", "答案": "a"}]), [])

    def test_cold_start(self):
        self.assertTrue(cold_start_protected([{"问题": "q", "答案": "a"}], [], None))
        self.assertFalse(cold_start_protected([{"问题": "q", "答案": "a"}], [{"问题": "q", "答案": "a"}], None))


if __name__ == "__main__":
    unittest.main()
