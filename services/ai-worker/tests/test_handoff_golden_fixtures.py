import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""GF-HANDOFF golden execution (M9)."""
import os
import unittest
from m9_golden_runner import run_all_handoff_goldens


class TestHandoffGoldens(unittest.TestCase):
    def test_all_goldens(self):
        fixtures = os.path.join(os.path.dirname(__file__), "..", "..", "..", "parity-tests", "fixtures", "handoff")
        r = run_all_handoff_goldens(os.path.abspath(fixtures))
        self.assertEqual(r["failed"], 0, str([x for x in r["results"] if x["result"] != "PASS"]))
        self.assertEqual(r["passed"], 21)


if __name__ == "__main__":
    unittest.main()
