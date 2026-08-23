import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""M5: executes all discovered GF-CONV fixtures via the real engine (harness)."""
import json
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from m5_conversation_helpers import run_all_conversation_goldens

_FIXTURES = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "parity-tests", "fixtures", "conv")


class TestConversationGoldenFixtures(unittest.TestCase):
    def test_all_discovered_fixtures_pass(self):
        self.assertTrue(os.path.isdir(_FIXTURES))
        r = run_all_conversation_goldens(_FIXTURES)
        self.assertGreaterEqual(r["discovered"], 16)
        self.assertEqual(r["failed"], 0, "failing: " + json.dumps(r["failed_ids"]))


if __name__ == "__main__":
    unittest.main()
