"""Prompt selector component tests (TASK-019 M4)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.prompt.prompt_selector import select_profile, select_profile_decision


class TestPromptSelector(unittest.TestCase):
    def setUp(self):
        self.config = {"prompts": {"未下单ID": "p-not-order", "已下单ID": "p-ordered"}}

    def test_select_not_ordered(self):
        self.assertEqual(select_profile("未下单", self.config), "p-not-order")

    def test_select_ordered(self):
        self.assertEqual(select_profile("已下单", self.config), "p-ordered")

    def test_unknown_order_state_defaults_to_not_ordered(self):
        self.assertEqual(select_profile("未知状态", self.config), "p-not-order")

    def test_decision_envelope_not_ordered(self):
        self.assertEqual(select_profile_decision("未下单", self.config), [{"profile": "p-not-order"}])

    def test_decision_envelope_ordered(self):
        self.assertEqual(select_profile_decision("已下单", self.config), [{"profile": "p-ordered"}])

    def test_missing_prompt_config_returns_empty(self):
        self.assertEqual(select_profile("已下单", {}), "")


if __name__ == "__main__":
    unittest.main()
