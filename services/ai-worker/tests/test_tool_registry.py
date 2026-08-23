"""ToolRegistry tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.tool_registry import ToolRegistry
from fastwork_ai_worker.tools.types import ToolDefinition


class TestToolRegistry(unittest.TestCase):
    def test_register_skill_returns_definition(self):
        r = ToolRegistry()
        d = r.register_skill({"name": "自动备注", "description": "备注", "skill_type": "instruction"})
        self.assertIsInstance(d, ToolDefinition)
        self.assertEqual(d.name, "自动备注")
        self.assertEqual(r.get("自动备注"), d)

    def test_register_skill_infers_query_from_run_command(self):
        r = ToolRegistry()
        d = r.register_skill({"name": "查价", "run": {"command": "scripts/query.py"}})
        self.assertEqual(d.skill_type, "query")

    def test_register_builtin_stores_handler(self):
        r = ToolRegistry()
        called = []
        def handler(args):
            called.append(args)
            return {"ok": True}
        d = r.register_builtin("转接人工客服", handler, description="转接")
        self.assertEqual(d.skill_type, "builtin")
        self.assertEqual(r.get_handler("转接人工客服"), handler)

    def test_get_missing_returns_none(self):
        self.assertIsNone(ToolRegistry().get("nope"))

    def test_names(self):
        r = ToolRegistry()
        r.register_builtin("a", lambda args: {})
        r.register_skill({"name": "b"})
        self.assertEqual(r.names(), ["a", "b"])


if __name__ == "__main__":
    unittest.main()
