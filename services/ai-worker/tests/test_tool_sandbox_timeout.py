"""Subprocess timeout/kill tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.sandbox.process_runner import run_process


class TestToolSandboxTimeout(unittest.TestCase):
    def test_timeout_kills_subprocess(self):
        result = run_process(
            [sys.executable, "-c", "import time; time.sleep(10)"],
            timeout_ms=200,
        )
        self.assertFalse(result.ok)
        self.assertTrue(result.timed_out)
        self.assertTrue(result.killed)
        self.assertEqual(result.error, "tool.timeout")

    def test_output_is_bounded(self):
        result = run_process(
            [sys.executable, "-c", "print('x' * 100000)"],
            timeout_ms=10000,
        )
        self.assertTrue(result.ok)
        self.assertLessEqual(len(result.stdout), 65536)

    def test_rejects_shell_string(self):
        with self.assertRaises(TypeError):
            run_process("echo hi", timeout_ms=1000)


if __name__ == "__main__":
    unittest.main()
