"""M4 test-only RPC guard tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rpc.methods.m4_test_only import is_test_mode, M4TestOnlyMethods
from fastwork_ai_worker.rpc.methods.test_only import is_test_mode as base_is_test_mode


class _FakeServer:
    pass


class TestM4TestRpcGuard(unittest.TestCase):
    def test_test_mode_env(self):
        old = os.environ.get("FASTWORK_RPC_TEST_MODE")
        os.environ["FASTWORK_RPC_TEST_MODE"] = "1"
        try:
            self.assertTrue(is_test_mode())
        finally:
            if old is None:
                os.environ.pop("FASTWORK_RPC_TEST_MODE", None)
            else:
                os.environ["FASTWORK_RPC_TEST_MODE"] = old

    def test_not_registered_without_test_mode(self):
        old = os.environ.get("FASTWORK_RPC_TEST_MODE")
        os.environ.pop("FASTWORK_RPC_TEST_MODE", None)
        try:
            methods = M4TestOnlyMethods(_FakeServer())
            registered = []
            methods.register(type("D", (), {"register": lambda self, n, h: registered.append(n)})())
            self.assertEqual(registered, [])
        finally:
            if old is not None:
                os.environ["FASTWORK_RPC_TEST_MODE"] = old

    def test_registered_with_test_mode(self):
        old = os.environ.get("FASTWORK_RPC_TEST_MODE")
        os.environ["FASTWORK_RPC_TEST_MODE"] = "1"
        try:
            methods = M4TestOnlyMethods(_FakeServer())
            registered = []
            methods.register(type("D", (), {"register": lambda self, n, h: registered.append(n)})())
            self.assertEqual(
                set(registered),
                {"test.prompt_assemble", "test.provider_route", "test.provider_normalize", "test.agent_run"},
            )
        finally:
            if old is None:
                os.environ.pop("FASTWORK_RPC_TEST_MODE", None)
            else:
                os.environ["FASTWORK_RPC_TEST_MODE"] = old


if __name__ == "__main__":
    unittest.main()
