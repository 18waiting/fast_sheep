"""M3 RAG RPC methods tests: validation, retrieve, rebuild, index_status."""
import asyncio
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rpc.methods.rag import RagMethods
from fastwork_ai_worker.rpc import protocol as rpc_protocol


class _FakeServer:
    pass


class TestRagRpcMethods(unittest.IsolatedAsyncioTestCase):
    def _req(self, payload):
        return {"version": 1, "request_id": "r1", "method": "rag.retrieve", "payload": payload}

    async def test_retrieve_validation(self):
        methods = RagMethods(_FakeServer())
        with self.assertRaises(Exception) as ctx:
            await methods.retrieve(self._req({"query": ""}))
        # invalid (empty query fails minLength) -> invalid_request validation error
        self.assertEqual(getattr(ctx.exception, "code", None), "rag.invalid_request")

    async def test_index_status_validation_and_response(self):
        methods = RagMethods(_FakeServer())
        # empty payload allowed; returns a status dict
        status = await methods.index_status(self._req({}))
        self.assertIn("ready", status)
        self.assertEqual(status["dimension"], 1024)
        self.assertEqual(status["metric"], "INNER_PRODUCT")

    async def test_retrieve_not_ready_error(self):
        methods = RagMethods(_FakeServer())
        # No derived index exists in the temp data root -> index_not_ready
        old = os.environ.get("FASTWORK_DATA_DIR")
        with tempfile.TemporaryDirectory() as root:
            os.environ["FASTWORK_DATA_DIR"] = root
            try:
                with self.assertRaises(Exception) as ctx:
                    await methods.retrieve(self._req({"query": "测试", "product_id": "P1"}))
                self.assertTrue(any(c in str(ctx.exception) for c in ("index_not_ready", "not ready")))
            finally:
                if old is None:
                    os.environ.pop("FASTWORK_DATA_DIR", None)
                else:
                    os.environ["FASTWORK_DATA_DIR"] = old


if __name__ == "__main__":
    unittest.main()
