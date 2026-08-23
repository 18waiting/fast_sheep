import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Audit RPC (M10): audit.decide registered."""
import unittest
from fastwork_ai_worker.rpc.server import RpcServer


class TestAuditRpc(unittest.TestCase):
    def setUp(self):
        self.dispatcher = RpcServer()._dispatcher

    def test_decide_registered(self):
        self.assertTrue(self.dispatcher.has("audit.decide"))


if __name__ == "__main__":
    unittest.main()
