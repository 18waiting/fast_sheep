import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Feedback idempotency (M9): bounded applied set."""
import unittest
from fastwork_ai_worker.feedback.idempotency import FeedbackIdempotency

class TestFeedbackIdempotency(unittest.TestCase):
    def test_applied_once(self):
        d = FeedbackIdempotency(4)
        self.assertFalse(d.was_applied("r1"))
        d.mark_applied("r1")
        self.assertTrue(d.was_applied("r1"))

    def test_bounded(self):
        d = FeedbackIdempotency(4)
        for i in range(20):
            d.mark_applied("r" + str(i))
        self.assertLessEqual(len(d._applied), 4)

if __name__ == "__main__":
    unittest.main()
