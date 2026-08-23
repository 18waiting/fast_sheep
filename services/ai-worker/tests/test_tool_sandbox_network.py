"""Sandbox network policy tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.sandbox.environment import build_whitelist_env
from fastwork_ai_worker.tools.sandbox.policy import SandboxPolicy


class TestToolSandboxNetwork(unittest.TestCase):
    def test_network_disabled_by_default(self):
        self.assertEqual(
            SandboxPolicy().check_network(),
            {"blocked": True, "reason": "network_disabled"},
        )

    def test_network_can_be_enabled_explicitly(self):
        self.assertEqual(SandboxPolicy(network=True).check_network(), {"blocked": False})

    def test_whitelist_env_drops_secret_keys(self):
        env = {
            "PATH": "C:/Windows",
            "SECRET_KEY": "abc",
            "API_TOKEN": "def",
            "NORMAL": "1",
        }
        out = build_whitelist_env(env, allowed_keys=("PATH", "SECRET_KEY", "API_TOKEN", "NORMAL"))
        self.assertEqual(out, {"PATH": "C:/Windows", "NORMAL": "1"})

    def test_whitelist_env_empty_by_default(self):
        self.assertEqual(build_whitelist_env({"A": "1"}), {})


if __name__ == "__main__":
    unittest.main()
