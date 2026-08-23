"""M4 usage_calculator tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.usage_calculator import calculate


class TestUsageCalculator(unittest.TestCase):
    def test_zero_chars_no_policy(self):
        self.assertEqual(
            calculate(0, 0),
            {"input_chars": 0, "output_chars": 0, "multiplier": 1.0, "cost_units": 0.0},
        )

    def test_one_unit_without_policy_uses_default_rate(self):
        # ceil(1000/1000) * 1.0 * 0.1 - 0 = 0.1
        self.assertEqual(calculate(600, 400)["cost_units"], 0.1)

    def test_ceil_rounds_up_to_next_thousand(self):
        # ceil(1001/1000)=2 -> 2*1.0*0.1 = 0.2
        self.assertEqual(calculate(1001, 0)["cost_units"], 0.2)

    def test_policy_rate_and_base(self):
        # ceil(2000/1000)=2 -> 2 * 2.0 * 0.2 - 0.5 = 0.3
        out = calculate(2000, 0, multiplier=2.0, policy={"rate": 0.2, "base": 0.5})
        self.assertEqual(out["multiplier"], 2.0)
        self.assertEqual(out["cost_units"], 0.3)

    def test_negative_floor(self):
        # Base larger than raw cost -> floor at 0.
        out = calculate(0, 0, policy={"base": 1.0})
        self.assertEqual(out["cost_units"], 0.0)


if __name__ == "__main__":
    unittest.main()