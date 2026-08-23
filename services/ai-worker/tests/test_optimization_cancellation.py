import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Optimization cancellation (M10): propose is non-mutating; cancelled jobs never apply."""
import unittest
from fastwork_ai_worker.optimization.product_optimization_engine import ProductOptimizationEngine
from fastwork_ai_worker.optimization.job_handler import handle_job


class TestOptimizationCancellation(unittest.TestCase):
    def test_propose_is_read_only(self):
        eng = ProductOptimizationEngine()
        before = None
        res = eng.propose({"product_id": "10001"})
        # The engine only proposes; it never writes a product row.
        self.assertIn("proposal", res["decisions"])
        self.assertEqual(before, None)

    def test_job_handler_surfaces_failure(self):
        from fastwork_ai_worker.optimization.optimization_provider import MockOptimizationProvider
        eng = ProductOptimizationEngine(provider=MockOptimizationProvider(fail=True))
        res = handle_job({"product_id": "10001"}, eng)
        self.assertEqual(res["decisions"]["job_state"], "FAILED")


if __name__ == "__main__":
    unittest.main()
