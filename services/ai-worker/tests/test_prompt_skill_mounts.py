"""Skill-mount resolver component tests (TASK-019 M4)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.prompt.skill_mount_resolver import resolve_decision, resolve_mounted_skills


class TestPromptSkillMounts(unittest.TestCase):
    def test_profile_skills(self):
        profiles = {"p1": {"mounted_skills": ["skill-a"]}}
        self.assertEqual(resolve_mounted_skills("p1", None, profiles, {}), ["skill-a"])

    def test_product_skills(self):
        product_skills = {"10001": ["skill-b"]}
        self.assertEqual(resolve_mounted_skills(None, "10001", {}, product_skills), ["skill-b"])

    def test_union_dedup_profile_first(self):
        profiles = {"p1": {"mounted_skills": ["skill-a", "skill-c"]}}
        product_skills = {"10001": ["skill-b", "skill-c"]}
        self.assertEqual(
            resolve_mounted_skills("p1", "10001", profiles, product_skills),
            ["skill-a", "skill-c", "skill-b"],
        )

    def test_decision_envelope(self):
        profiles = {"p1": {"mounted_skills": ["skill-a"]}}
        self.assertEqual(resolve_decision("p1", None, profiles, {}), {"mounted_skills": ["skill-a"]})

    def test_missing_profile_and_product(self):
        self.assertEqual(resolve_mounted_skills("missing", "missing", {}, {}), [])

    def test_empty_mounted_skills_is_tolerated(self):
        self.assertEqual(resolve_mounted_skills("p1", "10001", {"p1": {}}, {"10001": None}), [])


if __name__ == "__main__":
    unittest.main()
