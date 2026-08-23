"""SandboxPolicy tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.sandbox.policy import SandboxPolicy


class TestSandboxPolicy(unittest.TestCase):
    def test_network_denied(self):
        p = SandboxPolicy(network=False)
        self.assertEqual(p.check_network(), {"blocked": True, "reason": "network_disabled"})

    def test_network_allowed(self):
        p = SandboxPolicy(network=True)
        self.assertEqual(p.check_network(), {"blocked": False})

    def test_data_write_read_only(self):
        p = SandboxPolicy(data_read_only=True)
        self.assertEqual(p.check_data_write("data/data.csv"), {"blocked": True, "reason": "read_only"})

    def test_data_write_allowed(self):
        p = SandboxPolicy(data_read_only=False)
        self.assertEqual(p.check_data_write("data/data.csv"), {"blocked": False})

    def test_defaults(self):
        p = SandboxPolicy()
        self.assertFalse(p.network)
        self.assertTrue(p.data_read_only)
        self.assertEqual(p.timeout_ms, 5000)
        self.assertEqual(p.output_limit, 65536)


if __name__ == "__main__":
    unittest.main()
