import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""M5: order context (GF-CONV-ORD-001/002)."""
from fastwork_ai_worker.conversation.order_context import OrderContextProvider


class TestOrderContext(unittest.TestCase):
    def test_ordered(self):
        r = OrderContextProvider().resolve({"order_state": "已下单"})
        self.assertEqual(r["order_state"], "已下单")
        self.assertEqual(r["tags"], ["#已下单"])

    def test_not_ordered(self):
        r = OrderContextProvider().resolve({"order_state": "未下单"})
        self.assertEqual(r["order_state"], "未下单")
        self.assertEqual(r["tags"], ["#未下单"])

    def test_unknown_defaults_not_ordered(self):
        r = OrderContextProvider().resolve({})
        self.assertEqual(r["order_state"], "未下单")


if __name__ == "__main__":
    unittest.main()
