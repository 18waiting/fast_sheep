import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""GF-AUDIT golden execution (M10)."""
import os
import unittest
from m10_helpers import run_audit_case

FIXTURES = os.path.join(os.path.dirname(__file__), "..", "..", "..", "parity-tests", "fixtures", "audit")


def discover() -> list:
    import glob
    return sorted(glob.glob(os.path.join(FIXTURES, "*.json")))


class TestAUDITGoldens(unittest.TestCase):
    def test_all_discovered(self):
        import json
        results = []
        failed = 0
        for f in discover():
            with open(f, encoding="utf-8") as fh:
                fx = json.load(fh)
            if not fx.get("case_id", "").startswith("GF-AUDIT"):
                continue
            result = run_audit_case(fx)
            results.append({"case_id": fx["case_id"], "result": result})
            if result != "PASS":
                failed += 1
        self.assertEqual(failed, 0, str([x for x in results if x["result"] != "PASS"]))
        self.assertEqual(len(results), 5, "discovered GF-AUDIT fixtures")


if __name__ == "__main__":
    unittest.main()
