import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Review RPC (M10): review.propose/apply/restore registered."""
import unittest
from fastwork_ai_worker.rpc.server import RpcServer


class TestReviewRpc(unittest.TestCase):
    def setUp(self):
        self.dispatcher = RpcServer()._dispatcher

    def test_methods_registered(self):
        for m in ("review.propose", "review.apply", "review.restore"):
            self.assertTrue(self.dispatcher.has(m), m)


if __name__ == "__main__":
    unittest.main()
