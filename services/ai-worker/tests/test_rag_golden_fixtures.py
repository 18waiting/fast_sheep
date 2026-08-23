"""M3 golden fixture execution: all discovered GF-RAG-* fixtures must pass."""
import json
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from rag_helpers import run_all_golden_fixtures

_FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "parity-tests", "fixtures", "rag")


class TestRagGoldenFixtures(unittest.TestCase):
    def test_all_discovered_fixtures_pass(self):
        self.assertTrue(os.path.isdir(_FIXTURES_DIR), "fixtures dir missing: " + _FIXTURES_DIR)
        r = run_all_golden_fixtures(_FIXTURES_DIR)
        self.assertGreaterEqual(r["discovered"], 26, "expected at least 26 GF-RAG fixtures on disk")
        self.assertEqual(r["failed"], 0, "failing fixtures: " + json.dumps(r["failed_ids"]))
        self.assertEqual(r["passed"], r["discovered"])


if __name__ == "__main__":
    unittest.main()
