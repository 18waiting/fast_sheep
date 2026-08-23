"""Prompt budgeter component tests (TASK-019 M4)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.prompt.prompt_budgeter import budget_decide, PRIORITY_ORDER


def _contents(ref, hist, prod, head):
    return {"reference": ref, "history": hist, "product": prod, "head": head}


def _budget(total, ref, hist, prod, head):
    return {
        "total_chars": total,
        "reference_chars": ref,
        "history_chars": hist,
        "product_chars": prod,
        "head_chars": head,
    }


class TestPromptBudgeter(unittest.TestCase):
    def test_truncate_order_is_fixed_priority(self):
        out = budget_decide(_contents(200, 400, 300, 100), _budget(1000, 200, 400, 300, 100))
        self.assertEqual(out["truncate_order"], ["reference", "history", "product", "head"])

    def test_reference_only_overage(self):
        out = budget_decide(_contents(400, 200, 200, 100), _budget(1000, 400, 200, 200, 100))
        self.assertEqual(out["truncate"], ["reference"])
        self.assertEqual(out["cut"], 200)

    def test_reference_history_boundary_zero_cut(self):
        out = budget_decide(_contents(300, 400, 200, 100), _budget(1000, 300, 400, 200, 100))
        self.assertEqual(out["truncate"], ["reference", "history"])
        self.assertEqual(out["cut"], 300)

    def test_head_is_last_in_truncation_order(self):
        out = budget_decide(_contents(300, 300, 400, 300), _budget(1000, 300, 300, 400, 300))
        self.assertEqual(out["truncate_order"][-1], "head")

    def test_no_overage_has_empty_truncation(self):
        out = budget_decide(_contents(100, 100, 100, 100), _budget(1000, 100, 100, 100, 100))
        self.assertEqual(out["truncate"], [])
        self.assertEqual(out["cut"], 0)

    def test_partial_cut_stops_at_partially_cut_slot(self):
        # overage 300; reference (200) is fully cut, history (400) is partially cut.
        out = budget_decide(_contents(200, 400, 300, 100), _budget(1000, 200, 400, 300, 100))
        self.assertEqual(out["truncate"], ["reference", "history"])
        self.assertEqual(out["cut"], 300)

    def test_string_contents_are_measured_by_length(self):
        out = budget_decide({"reference": "x" * 400, "history": "y" * 200, "product": "z" * 200, "head": "h" * 100}, _budget(1000, 400, 200, 200, 100))
        self.assertEqual(out["truncate"], ["reference"])
        self.assertEqual(out["cut"], 200)

    def test_question_length_defaults_to_300(self):
        # sum=1000 + question=300 - total=1300 => overage 300.
        out = budget_decide(_contents(200, 400, 300, 100), _budget(1000, 200, 400, 300, 100))
        self.assertEqual(out["cut"], 300)


if __name__ == "__main__":
    unittest.main()
