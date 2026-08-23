import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""handoff.evaluate RPC (M9)."""
import asyncio
import unittest
from fastwork_ai_worker.rpc.methods.handoff import HandoffMethods


class _D:
    def __init__(self):
        self.registered = {}
    def register(self, name, fn):
        self.registered[name] = fn


class TestHandoffRpc(unittest.TestCase):
    def test_register_and_evaluate(self):
        d = _D()
        HandoffMethods(None).register(d)
        self.assertIn("handoff.evaluate", d.registered)
        res = asyncio.run(d.registered["handoff.evaluate"]({"payload": {"question": "退款", "rules": [{"keyword": "退款", "target": "售后"}]}}))
        self.assertTrue(res["decision"]["transfer"])

if __name__ == "__main__":
    unittest.main()
