"""PromptEngine facade tests (TASK-019 M4)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.prompt.prompt_engine import PromptEngine


class TestPromptEngine(unittest.TestCase):
    def setUp(self):
        self.engine = PromptEngine()

    def test_prepare_returns_assemble_shape(self):
        result = self.engine.prepare({"profile_id": "p1"})
        self.assertEqual(
            set(result),
            {"slots", "order", "mounted_skills", "skill_context_included", "image_rule", "prompt", "messages"},
        )
        self.assertEqual(result["order"], ["head", "product", "history", "reference"])
        self.assertTrue(result["skill_context_included"])
        self.assertEqual(result["image_rule"], "")
        self.assertEqual(len(result["messages"]), 2)

    def test_prepare_uses_embedded_profiles_and_product_skills(self):
        request = {
            "profile_id": "p1",
            "product_id": "10001",
            "profiles": {"p1": {"mounted_skills": ["skill-a"]}},
            "product_skills": {"10001": ["skill-b"]},
        }
        result = self.engine.prepare(request)
        self.assertEqual(result["mounted_skills"], ["skill-a", "skill-b"])

    def test_prepare_handles_empty_request(self):
        result = self.engine.prepare({})
        self.assertEqual(result["slots"], [])
        self.assertEqual(result["mounted_skills"], [])


if __name__ == "__main__":
    unittest.main()
