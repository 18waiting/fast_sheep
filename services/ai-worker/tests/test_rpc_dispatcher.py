"""M2 dispatcher tests: registration, lookup, version/method errors, task lifecycle."""
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rpc.dispatcher import Dispatcher
from fastwork_ai_worker.rpc.errors import WorkerRpcError


class TestDispatcher(unittest.TestCase):
    def test_register_and_has(self):
        d = Dispatcher()
        async def h(req):
            return {}
        d.register("test.echo", h)
        self.assertTrue(d.has("test.echo"))
        d.unregister("test.echo")
        self.assertFalse(d.has("test.echo"))

    def test_resolve_ok(self):
        d = Dispatcher()
        async def h(req):
            return {}
        d.register("ping", h)
        rid, handler, err = d.resolve({"version": 1, "request_id": "r1", "method": "ping", "payload": {}})
        self.assertEqual(rid, "r1")
        self.assertIsNotNone(handler)
        self.assertIsNone(err)

    def test_resolve_unknown_version(self):
        d = Dispatcher()
        rid, handler, err = d.resolve({"version": 99, "request_id": "r1", "method": "ping", "payload": {}})
        self.assertIsNone(rid)
        self.assertIsNone(handler)
        self.assertEqual(err.code, "version.unsupported")

    def test_resolve_unknown_method(self):
        d = Dispatcher()
        rid, handler, err = d.resolve({"version": 1, "request_id": "r1", "method": "nope", "payload": {}})
        self.assertEqual(err.code, "method.unknown")

    def test_resolve_missing_version_raises_version_unsupported(self):
        d = Dispatcher()
        rid, handler, err = d.resolve({"method": "ping"})
        self.assertEqual(err.code, "version.unsupported")

    def test_resolve_invalid_envelope(self):
        d = Dispatcher()
        rid, handler, err = d.resolve({"version": 1, "request_id": "r1"})
        self.assertEqual(err.code, "protocol_error")

    def test_schedule_success_and_exception_conversion(self):
        async def scenario():
            d = Dispatcher()
            async def h(req):
                return {"ok": True}
            d.register("m", h)
            responses = []
            task = d.schedule({"version": 1, "request_id": "r1", "method": "m", "payload": {}}, h, responses.append)
            self.assertIsNotNone(task)
            await asyncio.sleep(0.05)
            self.assertEqual(len(responses), 1)
            self.assertTrue(responses[0]["ok"])
            self.assertEqual(responses[0]["request_id"], "r1")
        asyncio.run(scenario())

    def test_schedule_duplicate_request_id(self):
        async def scenario():
            d = Dispatcher()
            async def h(req):
                return {}
            d.register("m", h)
            req = {"version": 1, "request_id": "r1", "method": "m", "payload": {}}
            t1 = d.schedule(req, h, lambda _f: None)
            t2 = d.schedule(req, h, lambda _f: None)
            self.assertIsNotNone(t1)
            self.assertIsNone(t2)  # duplicate rejected
            await asyncio.sleep(0.05)
        asyncio.run(scenario())

    def test_schedule_exception_becomes_internal_error(self):
        async def scenario():
            d = Dispatcher()
            async def h(req):
                raise ValueError("boom")
            d.register("m", h)
            responses = []
            d.schedule({"version": 1, "request_id": "r1", "method": "m", "payload": {}}, h, responses.append)
            await asyncio.sleep(0.05)
            self.assertEqual(len(responses), 1)
            self.assertFalse(responses[0]["ok"])
            self.assertEqual(responses[0]["error"]["code"], "internal")
        asyncio.run(scenario())


if __name__ == "__main__":
    unittest.main()
