import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Legacy knowledge CSV parser (M11): 4-col canonical + malformed auto-repair."""
import unittest
from fastwork_ai_worker.legacy_import.knowledge_csv_parser import parse_knowledge_csv


class TestKnowledgeCsv(unittest.TestCase):
    def test_canonical_4col(self):
        r = parse_knowledge_csv("问题,答案,商品ID,标签\n这个多少钱,99元,10001,\n")
        self.assertEqual(r["rows"][0]["问题"], "这个多少钱")
        self.assertEqual(r["headers"], ["问题", "答案", "商品ID", "标签"])

    def test_bom_and_quoted_commas(self):
        r = parse_knowledge_csv("\ufeff问题,答案,商品ID,标签\n\"带,逗号\",答案,1,\n")
        self.assertEqual(r["rows"][0]["问题"], "带,逗号")

    def test_malformed_auto_repair(self):
        r = parse_knowledge_csv("问题,答案,商品ID,标签\n问题1,答案1\n问题2,答案2,10001\n")
        self.assertTrue(r["auto_repair"])
        self.assertEqual(len(r["rows"]), 2)

    def test_empty_rows_skipped(self):
        r = parse_knowledge_csv("问题,答案,商品ID,标签\n\n,,\n")
        self.assertEqual(len(r["rows"]), 0)


if __name__ == "__main__":
    unittest.main()
