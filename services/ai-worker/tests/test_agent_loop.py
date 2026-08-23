"""AgentLoop component tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.agent_loop import AgentLoop
from fastwork_ai_worker.tools.tool_executor import ToolExecutor
from fastwork_ai_worker.tools.tool_registry import ToolRegistry


class SequenceProvider:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.calls = 0

    def generate(self, messages):
        self.calls += 1
        if self.outputs:
            return self.outputs.pop(0)
        return {"text": "done"}


class AlwaysToolProvider:
    def __init__(self, name="查价", arguments=None):
        self.name = name
        self.arguments = arguments if arguments is not None else {}
        self.calls = 0

    def generate(self, messages):
        self.calls += 1
        return {"tool_calls": [{"name": self.name, "arguments": self.arguments}]}


class TestAgentLoop(unittest.TestCase):
    def _registry(self, name="查价", result=None):
        r = ToolRegistry()
        if result is None:
            result = {"ok": True, "rows": 2}
        r.register_builtin(name, lambda args: result)
        return r

    def test_max_rounds(self):
        r = self._registry()
        e = ToolExecutor(r)
        provider = AlwaysToolProvider()
        call_log = []
        out = AgentLoop(provider, r, e, max_rounds=3, call_log=call_log).run({})
        self.assertEqual(out["rounds"], 3)
        self.assertEqual(out["terminated"], "max_rounds")
        self.assertEqual(out["action"], "apology")
        self.assertEqual(len(out["tool_results"]), 3)
        self.assertEqual(provider.calls, 3)

    def test_dead_loop_guard_same_error_twice_in_one_turn(self):
        r = self._registry(result={"ok": False, "error": {"code": "E1", "category": "tool", "message": ""}})
        e = ToolExecutor(r)
        provider = SequenceProvider([
            {
                "tool_calls": [
                    {"name": "查价", "arguments": {}},
                    {"name": "查价", "arguments": {}},
                ]
            }
        ])
        call_log = []
        out = AgentLoop(provider, r, e, call_log=call_log).run({})
        self.assertTrue(out["dead_loop_guard"])
        self.assertEqual(out["action"], "apology")
        self.assertEqual(out["terminated"], "dead_loop_guard")
        self.assertEqual(len(out["tool_results"]), 2)

    def test_tool_result_continues_to_next_model_turn(self):
        r = self._registry()
        e = ToolExecutor(r)
        provider = SequenceProvider([
            {"tool_calls": [{"name": "查价", "arguments": {}}]},
            {"text": "库存充足"},
        ])
        call_log = []
        out = AgentLoop(provider, r, e, call_log=call_log).run({})
        self.assertEqual(out["terminated"], "finish")
        self.assertEqual(out["text"], "库存充足")
        self.assertEqual(provider.calls, 2)
        trace = [entry for entry in call_log if entry[0] == "trace"]
        self.assertEqual(
            trace,
            [("trace", "TOOL_RESULT_APPEND"), ("trace", "NEXT_MODEL_TURN")],
        )


if __name__ == "__main__":
    unittest.main()
