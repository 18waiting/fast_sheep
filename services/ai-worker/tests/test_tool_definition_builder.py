"""ToolDefinitionBuilder tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.tool_definition_builder import from_skill


class TestToolDefinitionBuilder(unittest.TestCase):
    def test_instruction_default(self):
        d = from_skill({"name": "自动备注", "description": "desc"})
        self.assertEqual(d.name, "自动备注")
        self.assertEqual(d.description, "desc")
        self.assertEqual(d.skill_type, "instruction")
        self.assertEqual(d.body, "")
        self.assertTrue(d.enabled)

    def test_query_from_explicit_type_and_run(self):
        d = from_skill({
            "name": "查价",
            "type": "query",
            "run": {"runtime": "python", "command": "scripts/query.py", "timeout_ms": 30000},
        })
        self.assertEqual(d.skill_type, "query")
        self.assertEqual(d.run["command"], "scripts/query.py")

    def test_query_inferred_from_run_command(self):
        d = from_skill({"name": "查价", "run": {"command": "scripts/query.py"}})
        self.assertEqual(d.skill_type, "query")

    def test_id_fallback_name(self):
        d = from_skill({"id": "transfer_to_human", "type": "instruction", "body": "rules"})
        self.assertEqual(d.name, "transfer_to_human")
        self.assertEqual(d.body, "rules")

    def test_signature_and_disabled(self):
        d = from_skill({"name": "x", "signature": "sha256:abc", "enabled": False})
        self.assertEqual(d.signature, "sha256:abc")
        self.assertFalse(d.enabled)


if __name__ == "__main__":
    unittest.main()
