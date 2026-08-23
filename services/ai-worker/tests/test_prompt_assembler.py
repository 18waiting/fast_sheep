"""Prompt assembler component tests (TASK-019 M4)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.prompt.prompt_assembler import PLACEHOLDER_PROMPT, SLOT_ORDER, assemble


class TestPromptAssembler(unittest.TestCase):
    def test_four_slot_presence(self):
        out = assemble(
            {"profile_id": "p1", "product_info": "<PRODUCT_INFO>", "history": "<HISTORY>", "reference_content": "<REFERENCE>"},
            {"p1": {"mounted_skills": []}},
            {},
        )
        self.assertEqual(out["slots"], ["head", "product", "history", "reference"])
        self.assertEqual(out["order"], ["head", "product", "history", "reference"])

    def test_non_empty_slot_filtering(self):
        out = assemble(
            {"profile_id": "p1", "product_info": "<PRODUCT_INFO>", "history": "", "reference_content": ""},
            {"p1": {"mounted_skills": []}},
            {},
        )
        self.assertEqual(out["slots"], ["head", "product"])
        self.assertEqual(out["order"], SLOT_ORDER)

    def test_buyer_context_skip(self):
        out = assemble({"profile_id": "p1", "skip_skill_context": True}, {"p1": {"mounted_skills": []}}, {})
        self.assertFalse(out["skill_context_included"])

    def test_buyer_context_defaults_included(self):
        out = assemble({"profile_id": "p1"}, {"p1": {"mounted_skills": []}}, {})
        self.assertTrue(out["skill_context_included"])

    def test_image_rule_preserve(self):
        out = assemble(
            {"profile_id": "p1", "message_has_image": True, "product_has_image": True},
            {"p1": {"mounted_skills": []}},
            {},
        )
        self.assertEqual(out["image_rule"], "preserve_img_tag")

    def test_image_rule_empty(self):
        out = assemble({"profile_id": "p1"}, {"p1": {"mounted_skills": []}}, {})
        self.assertEqual(out["image_rule"], "")

    def test_mounted_skills_are_resolved(self):
        out = assemble(
            {"profile_id": "p1", "product_id": "10001"},
            {"p1": {"mounted_skills": ["skill-a", "skill-c"]}},
            {"10001": ["skill-b", "skill-c"]},
        )
        self.assertEqual(out["mounted_skills"], ["skill-a", "skill-c", "skill-b"])

    def test_prompt_uses_synthetic_placeholders_only(self):
        out = assemble(
            {"profile_id": "p1", "product_info": "<PRODUCT_INFO>", "history": "<HISTORY>", "reference_content": "<REFERENCE>"},
            {"p1": {"mounted_skills": []}},
            {},
        )
        self.assertIn("<PROMPT_CONTENT>", out["prompt"])
        self.assertIn("<PRODUCT_INFO>", out["prompt"])
        self.assertIn("<HISTORY>", out["prompt"])
        self.assertIn("<REFERENCE>", out["prompt"])
        self.assertNotIn("你是专业电商客服", out["prompt"])

    def test_messages_shape(self):
        out = assemble({"profile_id": "p1", "query": "这个多少钱"}, {"p1": {"mounted_skills": []}}, {})
        self.assertEqual(out["messages"][0]["role"], "system")
        self.assertEqual(out["messages"][1]["role"], "user")
        self.assertEqual(out["messages"][1]["content"], "这个多少钱")

    def test_profile_id_from_order_state_config(self):
        out = assemble(
            {"order_state": "已下单", "config": {"prompts": {"未下单ID": "p1", "已下单ID": "p2"}}},
            {"p2": {"mounted_skills": ["skill-ordered"]}},
            {},
        )
        self.assertEqual(out["mounted_skills"], ["skill-ordered"])


if __name__ == "__main__":
    unittest.main()
