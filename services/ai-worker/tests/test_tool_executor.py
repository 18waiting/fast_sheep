"""ToolExecutor component tests."""
import json
import os
import sys
import tempfile
import textwrap
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.tool_executor import ToolExecutor
from fastwork_ai_worker.tools.tool_registry import ToolRegistry


class TestToolExecutor(unittest.TestCase):
    def _write(self, directory, name, content):
        path = os.path.join(directory, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(textwrap.dedent(content))
        return path

    def _query_executor(self, directory, script, config=None):
        path = self._write(directory, "query.py", script)
        registry = ToolRegistry()
        registry.register_skill({
            "name": "查价",
            "type": "query",
            "run": {"command": path, "runtime": "python"},
        })
        return ToolExecutor(registry, sandbox_config=config)

    def test_instruction_skill_body_result(self):
        r = ToolRegistry()
        r.register_skill({"name": "自动备注", "type": "instruction", "body": "请执行备注"})
        out = ToolExecutor(r).execute({"tool_call_id": "c1", "name": "自动备注", "arguments": {"text": "已发货"}})
        self.assertTrue(out["ok"])
        self.assertEqual(out["text"], "请执行备注")
        self.assertEqual(out["parameters"], {"text": "已发货"})

    def test_builtin_handler_result(self):
        r = ToolRegistry()
        r.register_builtin("自动备注", lambda args: {"ok": True, "remark": "已备注"})
        out = ToolExecutor(r).execute({"tool_call_id": "c1", "name": "自动备注", "arguments": {"text": "已发货"}})
        self.assertTrue(out["ok"])
        self.assertEqual(out["remark"], "已备注")
        self.assertEqual(r.get("自动备注").skill_type, "builtin")

    def test_query_subprocess_success(self):
        with tempfile.TemporaryDirectory() as d:
            executor = self._query_executor(d, '''                import json, sys
                args = json.loads(sys.argv[1])
                print(json.dumps({"ok": True, "rows": 2, "region": args.get("region")}))
            ''')
            out = executor.execute({"tool_call_id": "c1", "name": "查价", "arguments": {"region": "上海"}})
        self.assertTrue(out["ok"])
        self.assertEqual(out["rows"], 2)
        self.assertEqual(out["region"], "上海")
        self.assertEqual(len(executor.call_log), 1)

    def test_unknown_tool(self):
        out = ToolExecutor().execute({"tool_call_id": "c1", "name": "no_such_tool", "arguments": {}})
        self.assertFalse(out["ok"])
        self.assertEqual(out["error"]["code"], "tool.unknown")

    def test_bad_json_arguments(self):
        r = ToolRegistry()
        r.register_skill({"name": "尺码推荐", "type": "instruction"})
        out = ToolExecutor(r).execute({"tool_call_id": "c1", "name": "尺码推荐", "arguments": "{bad json"})
        self.assertFalse(out["ok"])
        self.assertEqual(out["error"]["code"], "tool.bad_arguments")
        self.assertEqual(len(ToolExecutor(r).call_log), 0)

    def test_disabled_entitlement_no_call(self):
        called = []
        r = ToolRegistry()
        r.register_skill({"name": "尺码推荐", "type": "instruction", "handler": lambda args: called.append(args) or {"ok": True}})
        e = ToolExecutor(r)
        out = e.execute(
            {"tool_call_id": "c1", "name": "尺码推荐", "arguments": {}},
            entitlement={"disabled": ["尺码推荐"]},
        )
        self.assertFalse(out["ok"])
        self.assertEqual(out["error"]["code"], "tool.disabled")
        self.assertEqual(called, [])
        self.assertEqual(e.call_log, [])

    def test_disabled_definition(self):
        r = ToolRegistry()
        r.register_skill({"name": "x", "enabled": False})
        out = ToolExecutor(r).execute({"tool_call_id": "c1", "name": "x", "arguments": {}})
        self.assertEqual(out["error"]["code"], "tool.disabled")

    def test_query_timeout(self):
        with tempfile.TemporaryDirectory() as d:
            executor = self._query_executor(d, '''                import time
                time.sleep(10)
            ''', config={"timeout_ms": 200})
            out = executor.execute({"tool_call_id": "c1", "name": "查价", "arguments": {}})
        self.assertFalse(out["ok"])
        self.assertEqual(out["error"]["code"], "tool.timeout")
        self.assertEqual(len(executor.call_log), 1)

    def test_query_crash(self):
        with tempfile.TemporaryDirectory() as d:
            executor = self._query_executor(d, '''                import sys
                print("boom", file=sys.stderr)
                sys.exit(3)
            ''')
            out = executor.execute({"tool_call_id": "c1", "name": "查价", "arguments": {}})
        self.assertFalse(out["ok"])
        self.assertEqual(out["error"]["code"], "tool.crashed")
        self.assertIn("boom", out["error"]["message"])


if __name__ == "__main__":
    unittest.main()
