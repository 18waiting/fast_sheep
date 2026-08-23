import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""M5: welcome early return (GF-CONV-003)."""
from fastwork_ai_worker.conversation.welcome_policy import WelcomePolicy


class TestWelcome(unittest.TestCase):
    def test_early_return_when_first_in_period(self):
        w = WelcomePolicy(enabled=True, text="亲,欢迎光临~")
        r = w.decide(is_first_in_period=True)
        self.assertTrue(r["early_return"])
        self.assertEqual(r["reply"], "亲,欢迎光临~")

    def test_no_return_when_disabled(self):
        w = WelcomePolicy(enabled=False)
        r = w.decide(is_first_in_period=True)
        self.assertFalse(r["early_return"])


if __name__ == "__main__":
    unittest.main()
