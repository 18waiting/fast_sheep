import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""Optimization engine (M10): guards + proposal generation."""
import unittest
from fastwork_ai_worker.optimization.product_optimization_engine import ProductOptimizationEngine, guard_detail


class TestOptimizationEngine(unittest.TestCase):
    def test_empty_reject(self):
        g = guard_detail("", 20000)
        self.assertEqual((g["dirty"], g["reason"]), (True, "empty"))

    def test_length_exact_allowed(self):
        self.assertEqual(guard_detail("x" * 20000, 20000)["dirty"], False)
        self.assertEqual(guard_detail("x" * 20001, 20000)["reason"], "length")

    def test_html_reject(self):
        self.assertEqual(guard_detail("<div>垃圾</div>", 20000)["reason"], "html")

    def test_tailwind_reject(self):
        self.assertEqual(guard_detail('class="--tw-" content', 20000)["reason"], "tailwind")

    def test_propose_valid_candidate(self):
        eng = ProductOptimizationEngine()
        res = eng.propose({"product_id": "10001", "candidate": "<优化后详情>"})
        self.assertTrue(res["decisions"]["applied"])
        self.assertEqual(res["decisions"]["proposal"]["detail"], "<优化后详情>")

    def test_provider_proposal(self):
        eng = ProductOptimizationEngine()
        res = eng.propose({"product_id": "10001"})
        self.assertTrue(res["decisions"]["applied"])


if __name__ == "__main__":
    unittest.main()
