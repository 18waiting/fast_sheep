import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Optimization RPC (M10): optimization.propose registered (propose-only surface)."""
import unittest
from fastwork_ai_worker.rpc.server import RpcServer


class TestOptimizationRpc(unittest.TestCase):
    def setUp(self):
        self.dispatcher = RpcServer()._dispatcher

    def test_propose_registered(self):
        self.assertTrue(self.dispatcher.has("optimization.propose"))

    def test_no_apply_rpc(self):
        self.assertFalse(self.dispatcher.has("optimization.apply"))


if __name__ == "__main__":
    unittest.main()
