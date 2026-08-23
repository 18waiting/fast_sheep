"""M2 test-only method guard: registered only under FASTWORK_RPC_TEST_MODE=1."""
import asyncio
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rpc.dispatcher import Dispatcher
from fastwork_ai_worker.rpc.methods.test_only import TestOnlyMethods, is_test_mode
from fastwork_ai_worker.rpc.server import RpcServer


class _FakeServer:
    def __init__(self):
        self.events = []

    def emit_event(self, event, payload, correlation_id=None):
        self.events.append((event, payload, correlation_id))


class TestTestMethodGuard(unittest.TestCase):
    def test_is_test_mode_env(self):
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
            d = Dispatcher()
            TestOnlyMethods(_FakeServer()).register(d)
            self.assertFalse(d.has("ping"))
            self.assertFalse(d.has("test.echo"))
        finally:
            if old is not None:
                os.environ["FASTWORK_RPC_TEST_MODE"] = old

    def test_registered_with_test_mode(self):
        old = os.environ.get("FASTWORK_RPC_TEST_MODE")
        os.environ["FASTWORK_RPC_TEST_MODE"] = "1"
        try:
            d = Dispatcher()
            TestOnlyMethods(_FakeServer()).register(d)
            self.assertTrue(d.has("ping"))
            self.assertTrue(d.has("test.echo"))
            self.assertTrue(d.has("test.hang"))
            self.assertTrue(d.has("test.crash"))
        finally:
            if old is None:
                os.environ.pop("FASTWORK_RPC_TEST_MODE", None)
            else:
                os.environ["FASTWORK_RPC_TEST_MODE"] = old

    def test_production_server_returns_method_unknown_for_ping(self):
        old = os.environ.get("FASTWORK_RPC_TEST_MODE")
        os.environ.pop("FASTWORK_RPC_TEST_MODE", None)
        try:
            server = RpcServer()
            rid, handler, err = server.dispatcher.resolve({"version": 1, "request_id": "r1", "method": "ping", "payload": {}})
            self.assertIsNone(handler)
            self.assertEqual(err.code, "method.unknown")
        finally:
            if old is not None:
                os.environ["FASTWORK_RPC_TEST_MODE"] = old


if __name__ == "__main__":
    unittest.main()
