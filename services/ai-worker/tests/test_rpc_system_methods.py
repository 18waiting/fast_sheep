"""M2 system method tests: health, cancel, shutdown behavior."""
import asyncio
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rpc.errors import WorkerRpcError
from fastwork_ai_worker.rpc.methods.system import SystemMethods


class _FakeServer:
    def __init__(self):
        self.cancelled = []
        self.shutdown = False

    @property
    def cancellation(self):
        class _Reg:
            def __init__(self, owner):
                self.owner = owner

            def cancel(self, rid):
                self.owner.cancelled.append(rid)
                return True

        return _Reg(self)

    def request_shutdown(self):
        self.shutdown = True


class TestSystemMethods(unittest.IsolatedAsyncioTestCase):
    async def test_health_shape(self):
        s = SystemMethods(_FakeServer())
        result = await s.health({})
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["protocol_version"], 1)
        self.assertGreater(result["pid"], 0)
        self.assertGreaterEqual(result["uptime_ms"], 0)

    async def test_cancel_validates_payload(self):
        s = SystemMethods(_FakeServer())
        result = await s.cancel({"payload": {"target_request_id": "r1"}})
        self.assertTrue(result["cancelled"])
        self.assertEqual(result["request_id"], "r1")

    async def test_cancel_invalid_payload(self):
        s = SystemMethods(_FakeServer())
        with self.assertRaises(WorkerRpcError) as ctx:
            await s.cancel({"payload": {}})
        self.assertEqual(ctx.exception.code, "protocol_error")

    async def test_shutdown_requests_server_shutdown(self):
        server = _FakeServer()
        s = SystemMethods(server)
        result = await s.shutdown({})
        self.assertTrue(result["ok"])
        self.assertEqual(result["exit_code"], 0)
        self.assertTrue(server.shutdown)


if __name__ == "__main__":
    unittest.main()
