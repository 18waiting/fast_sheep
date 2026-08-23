import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Learning RPC (M10): learning.run registered + envelope validation."""
import unittest
from fastwork_ai_worker.rpc.server import RpcServer


class TestLearningRpc(unittest.TestCase):
    def setUp(self):
        self.server = RpcServer()
        self.dispatcher = self.server._dispatcher

    def test_method_registered(self):
        self.assertTrue(self.dispatcher.has("learning.run"))

    def test_invalid_request_rejected(self):
        async def call():
            with self.assertRaises(Exception):
                await self.dispatcher.dispatch("learning.run", {"payload": {"bad": 1}})
        import asyncio
        asyncio.run(call())


if __name__ == "__main__":
    unittest.main()
