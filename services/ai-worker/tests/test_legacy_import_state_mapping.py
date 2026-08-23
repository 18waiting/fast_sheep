import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Legacy A/B/pending state mapping (M11)."""
import unittest
from fastwork_ai_worker.legacy_import.knowledge_state_mapper import (
    library_for_path, trust_for_library, import_entry_id, map_rows_to_entries,
)


class TestStateMapping(unittest.TestCase):
    def test_library_for_path(self):
        self.assertEqual(library_for_path("A库全自动收录.csv"), "A库")
        self.assertEqual(library_for_path("B库人工确认过.csv"), "B库")
        self.assertEqual(library_for_path("待审核知识/待审核.csv"), "待审核")

    def test_trust_map(self):
        self.assertEqual(trust_for_library("A库"), "AUTO")
        self.assertEqual(trust_for_library("B库"), "HUMAN_CONFIRMED")
        self.assertEqual(trust_for_library("待审核"), "PENDING")

    def test_deterministic_identity(self):
        a = import_entry_id("sel", "it", "A库", "q", "a", "1")
        b = import_entry_id("sel", "it", "A库", "q", "a", "1")
        self.assertEqual(a, b)
        self.assertNotEqual(a, import_entry_id("sel", "it", "A库", "q2", "a", "1"))

    def test_map_rows_to_entries(self):
        entries = map_rows_to_entries("sel", "it", [{"问题": "q", "答案": "a", "商品ID": "", "标签": ""}], "B库")
        self.assertEqual(entries[0]["trust_level"], "HUMAN_CONFIRMED")
        self.assertEqual(entries[0]["product_id"], "1")


if __name__ == "__main__":
    unittest.main()
