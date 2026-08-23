import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""feedback.apply / feedback.retry RPC (M9)."""
import asyncio
import unittest
from fastwork_ai_worker.rpc.methods.feedback import FeedbackMethods


class _D:
    def __init__(self):
        self.registered = {}
    def register(self, name, fn):
        self.registered[name] = fn


class TestFeedbackRpc(unittest.TestCase):
    def test_register(self):
        d = _D()
        FeedbackMethods(None).register(d)
        self.assertIn("feedback.apply", d.registered)
        self.assertIn("feedback.retry", d.registered)

if __name__ == "__main__":
    unittest.main()
