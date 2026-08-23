import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Legacy candidate parser (M11): 待审核 -> knowledge_candidates."""
import unittest
from fastwork_ai_worker.legacy_import.candidate_parser import map_candidates


class TestCandidates(unittest.TestCase):
    def test_pending_rows_become_candidates(self):
        cands = map_candidates("sel", "it", [{"问题": "q", "答案": "a", "商品ID": "", "标签": ""}], "待审核")
        self.assertEqual(len(cands), 1)
        self.assertEqual(cands[0]["status"], "PENDING_REVIEW")
        self.assertEqual(cands[0]["origin"], "LEGACY_IMPORT")

    def test_empty_rows_skipped(self):
        cands = map_candidates("sel", "it", [{"问题": "", "答案": ""}], "待审核")
        self.assertEqual(len(cands), 0)


if __name__ == "__main__":
    unittest.main()
