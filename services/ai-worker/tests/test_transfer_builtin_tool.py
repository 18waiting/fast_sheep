"""Transfer built-in tool tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.builtin_transfer_tool import register, transfer_to_human
from fastwork_ai_worker.tools.tool_executor import ToolExecutor
from fastwork_ai_worker.tools.tool_registry import ToolRegistry


class TestTransferBuiltinTool(unittest.TestCase):
    def test_transfer_result(self):
        out = transfer_to_human({"reason": "售后"})
        self.assertTrue(out["ok"])
        self.assertEqual(out["result"]["decision"], {
            "requested": True,
            "target": "人工",
            "reason": "售后",
        })

    def test_register_and_execute(self):
        r = ToolRegistry()
        register(r)
        self.assertIn("转接人工客服", r.names())
        out = ToolExecutor(r).execute({
            "tool_call_id": "c1",
            "name": "转接人工客服",
            "arguments": {"reason": "售后"},
        })
        self.assertTrue(out["ok"])
        self.assertEqual(out["result"]["decision"]["target"], "人工")
        self.assertEqual(out["result"]["decision"]["reason"], "售后")


if __name__ == "__main__":
    unittest.main()
