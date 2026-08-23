import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Target selector (M9): injectable RNG, deterministic."""
import unittest
from fastwork_ai_worker.handoff.target_selector import RandomProvider, select_target

class FixedRng:
    def choice(self, items):
        return items[0]

class TestTargetSelector(unittest.TestCase):
    def test_single(self):
        self.assertEqual(select_target("售后"), "售后")

    def test_multi_injected(self):
        self.assertEqual(select_target("A&B", RandomProvider(FixedRng())), "A")

    def test_empty(self):
        self.assertIsNone(select_target(""))

if __name__ == "__main__":
    unittest.main()
