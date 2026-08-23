import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Legacy import verify (M11): worker-side counts."""
import unittest
from fastwork_ai_worker.legacy_import.import_verifier import verify_counts


class TestVerify(unittest.TestCase):
    def test_counts_ok(self):
        r = verify_counts(5, 2, expected_knowledge=5, expected_candidates=2)
        self.assertTrue(r["all_ok"])

    def test_missing_knowledge_fails(self):
        r = verify_counts(3, 2, expected_knowledge=5)
        self.assertFalse(r["all_ok"])


if __name__ == "__main__":
    unittest.main()
