import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Optimization provider failure (M10): job FAILED, zero product writes."""
import unittest
from fastwork_ai_worker.optimization.product_optimization_engine import ProductOptimizationEngine
from fastwork_ai_worker.optimization.optimization_provider import MockOptimizationProvider


class TestOptimizationProviderFailure(unittest.TestCase):
    def test_failure_job_failed(self):
        eng = ProductOptimizationEngine(provider=MockOptimizationProvider(fail=True))
        res = eng.propose({"product_id": "10001"})
        self.assertEqual(res["decisions"]["job_state"], "FAILED")
        self.assertEqual(res["external_calls"], [])


if __name__ == "__main__":
    unittest.main()
