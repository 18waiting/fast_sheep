import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""M5: conversation.generate RPC method."""
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rpc.methods.conversation import ConversationMethods


class _FakeServer:
    pass


class TestConversationRpcMethod(unittest.IsolatedAsyncioTestCase):
    def _req(self, payload):
        return {"version": 1, "request_id": "r1", "method": "conversation.generate", "payload": payload}

    async def test_generate_returns_result(self):
        m = ConversationMethods(_FakeServer())
        r = await m.generate(self._req({"question": "你好"}))
        self.assertIn("trace", r)
        self.assertIn("reply", r)

    async def test_invalid_request_rejected(self):
        m = ConversationMethods(_FakeServer())
        with self.assertRaises(Exception) as ctx:
            await m.generate(self._req({"question": ""}))
        self.assertEqual(getattr(ctx.exception, "code", None), "conversation.invalid_request")


if __name__ == "__main__":
    unittest.main()
