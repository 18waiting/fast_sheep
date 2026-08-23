"""M4 golden fixture execution: all discovered GF-TOOL-* fixtures must pass."""
import json
import os
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.agent_loop import AgentLoop
from fastwork_ai_worker.tools.builtin_transfer_tool import register as register_transfer
from fastwork_ai_worker.tools.tool_executor import ToolExecutor
from fastwork_ai_worker.tools.tool_registry import ToolRegistry

_FIXTURES_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "parity-tests", "fixtures", "tool"
)


class SequenceProvider:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.calls = 0

    def generate(self, messages):
        self.calls += 1
        if self.outputs:
            return self.outputs.pop(0)
        return {"text": "done"}


def _write_script(directory, content):
    path = os.path.join(directory, "query.py")
    with open(path, "w", encoding="utf-8") as f:
        f.write(textwrap.dedent(content))
    return path


def _deep_matches(expected, actual):
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return False
        for key, value in expected.items():
            if key not in actual:
                return False
            if not _deep_matches(value, actual[key]):
                return False
        return True
    if isinstance(expected, (list, tuple)):
        if not isinstance(actual, (list, tuple)) or len(expected) != len(actual):
            return False
        return all(_deep_matches(e, a) for e, a in zip(expected, actual))
    if isinstance(expected, float) or isinstance(actual, float):
        try:
            return abs(float(expected) - float(actual)) <= 1e-9
        except (TypeError, ValueError):
            return False
    return expected == actual


def _make_executor_for_case(fx, tmpdir):
    mocks = fx.get("mocks", {})
    tool_mocks = mocks.get("tool", {})
    registry = ToolRegistry()

    for name, mock in tool_mocks.items():
        if "result" in mock:
            result = mock["result"]
            registry.register_skill({
                "name": name,
                "skill_type": "instruction",
                "handler": lambda args, result=result: dict(result),
            })
        elif "error" in mock:
            error = mock["error"]
            registry.register_skill({
                "name": name,
                "skill_type": "instruction",
                "handler": lambda args, error=error: {"ok": False, "error": dict(error)},
            })

    case_id = fx.get("case_id", "")
    if case_id == "GF-TOOL-002":
        path = _write_script(tmpdir, '''\
            import json, sys
            args = json.loads(sys.argv[1])
            print(json.dumps({"ok": True, "text": "<recommendation>", "args": args}))
        ''')
        registry.register_skill({
            "name": "尺码推荐",
            "type": "query",
            "run": {"command": path, "runtime": "python"},
        })
    elif case_id == "GF-TOOL-005":
        path = _write_script(tmpdir, '''\
            import json, sys
            args = json.loads(sys.argv[1])
            print(json.dumps({"ok": True, "rows": 2, "region": args.get("region")}))
        ''')
        registry.register_skill({
            "name": "快递表格查价",
            "type": "query",
            "run": {"command": path, "runtime": "python"},
        })
    elif case_id == "GF-TOOL-006":
        path = _write_script(tmpdir, '''\
            import time
            time.sleep(10)
        ''')
        registry.register_skill({
            "name": "快递表格查价",
            "type": "query",
            "run": {"command": path, "runtime": "python", "timeout_ms": 200},
        })
    elif case_id == "GF-TOOL-007":
        path = _write_script(tmpdir, '''\
            import sys
            print("boom", file=sys.stderr)
            sys.exit(3)
        ''')
        registry.register_skill({
            "name": "快递表格查价",
            "type": "query",
            "run": {"command": path, "runtime": "python"},
        })
    elif case_id in ("GF-TOOL-003", "GF-TOOL-004", "GF-TOOL-008"):
        registry.register_skill({"name": "尺码推荐", "type": "instruction", "body": "推荐"})
    elif case_id == "GF-TOOL-009":
        registry.register_builtin(
            "查价",
            lambda args: {"ok": False, "error": {"code": "E1", "category": "tool", "message": ""}},
        )
    elif case_id == "GF-TOOL-010":
        registry.register_builtin("查价", lambda args: {"ok": True})
    elif case_id == "GF-TOOL-011":
        registry.register_builtin("查价", lambda args: {"ok": True, "text": "库存充足"})
    elif case_id == "GF-TOOL-012":
        register_transfer(registry)

    return registry


def _run_fixture(fx):
    case_id = fx.get("case_id", "")
    expected = fx.get("expected", {})
    comparison = fx.get("comparison", {}).get("mode", "EXACT")
    input_data = fx.get("input", {})
    mocks = fx.get("mocks", {})

    with tempfile.TemporaryDirectory() as tmpdir:
        registry = _make_executor_for_case(fx, tmpdir)
        executor = ToolExecutor(registry)

        if case_id in ("GF-TOOL-009", "GF-TOOL-010", "GF-TOOL-011"):
            return _run_agent_case(fx, registry, executor)

        # Direct tool-call fixtures.
        tool_call = input_data.get("tool_call") or {}
        if not tool_call.get("name"):
            # GF-TOOL-006/007 use empty input and identify the tool through mocks.
            mock_names = list(mocks.get("tool", {}).keys())
            if len(mock_names) == 1:
                tool_call["name"] = mock_names[0]
        tool_call.setdefault("tool_call_id", "call_" + case_id)
        tool_call.setdefault("arguments", {})
        entitlement = mocks.get("entitlement")

        raw = executor.execute(tool_call, entitlement)

        if case_id == "GF-TOOL-012":
            actual = raw.get("result", raw)
            expected_result = expected.get("result", {})
        else:
            actual = raw
            expected_result = expected.get("result", {}).get("tool_result", expected.get("result", {}))

        passed = _deep_matches(expected_result, actual)
        notes = "expected=" + json.dumps(expected_result, ensure_ascii=False) + " actual=" + json.dumps(actual, ensure_ascii=False, default=str)

        ext_calls = expected.get("external_calls", [])
        tool_call_count = len(executor.call_log)
        if ext_calls:
            expected_count = sum(int(c.get("call", 0)) for c in ext_calls)
            if tool_call_count != expected_count:
                passed = False
                notes += " tool_calls=" + str(tool_call_count)
        elif "external_calls" in expected:
            # Explicit empty external_calls means NO_CALL.
            if tool_call_count != 0:
                passed = False
                notes += " unexpected_tool_calls=" + str(tool_call_count)

        return {
            "case_id": case_id,
            "result": "PASS" if passed else "FAIL",
            "notes": notes,
        }


def _run_agent_case(fx, registry, executor):
    case_id = fx.get("case_id", "")
    expected = fx.get("expected", {})
    mocks = fx.get("mocks", {})
    generation = mocks.get("generation", {})

    if case_id == "GF-TOOL-009":
        calls = generation.get("tool_calls", [])
        provider = SequenceProvider([{"tool_calls": calls}])
        call_log = []
        out = AgentLoop(provider, registry, executor, call_log=call_log).run({})
        decisions = [{"dead_loop_guard": out["dead_loop_guard"], "action": out["action"]}]
        passed = _deep_matches(expected.get("decisions", []), decisions)
        tool_calls = len([entry for entry in call_log if entry[0] == "tool"])
        ext_calls = expected.get("external_calls", [])
        if ext_calls:
            expected_count = sum(int(c.get("call", 0)) for c in ext_calls)
            if tool_calls != expected_count:
                passed = False
        return {
            "case_id": case_id,
            "result": "PASS" if passed else "FAIL",
            "notes": "decisions=" + json.dumps(decisions, ensure_ascii=False) + " tool_calls=" + str(tool_calls),
        }

    if case_id == "GF-TOOL-010":
        provider = SequenceProvider([])
        # always return a tool call regardless of message history.
        class AlwaysTool:
            def __init__(self):
                self.calls = 0
            def generate(self, messages):
                self.calls += 1
                return {"tool_calls": [{"name": "查价", "arguments": {}}]}
        always = AlwaysTool()
        max_rounds = fx.get("config", {}).get("agent_loop", {}).get("max_rounds", 3)
        out = AgentLoop(always, registry, executor, max_rounds=max_rounds).run({})
        decisions = [{"rounds": out["rounds"], "terminated": out["terminated"]}]
        passed = _deep_matches(expected.get("decisions", []), decisions)
        return {
            "case_id": case_id,
            "result": "PASS" if passed else "FAIL",
            "notes": "decisions=" + json.dumps(decisions, ensure_ascii=False),
        }

    if case_id == "GF-TOOL-011":
        provider = SequenceProvider([
            {"tool_calls": [{"name": "查价", "arguments": {}}]},
            {"text": "库存充足"},
        ])
        call_log = []
        out = AgentLoop(provider, registry, executor, call_log=call_log).run({})
        trace = [
            {"sequence": i + 1, "component": "AgentLoop", "operation": entry[1]}
            for i, entry in enumerate(entry for entry in call_log if entry[0] == "trace")
        ]
        passed = _deep_matches(expected.get("trace", []), trace)
        generation_calls = provider.calls
        ext_calls = expected.get("external_calls", [])
        if ext_calls:
            expected_count = sum(int(c.get("call", 0)) for c in ext_calls)
            if generation_calls != expected_count:
                passed = False
        return {
            "case_id": case_id,
            "result": "PASS" if passed else "FAIL",
            "notes": "trace=" + json.dumps(trace, ensure_ascii=False) + " generation_calls=" + str(generation_calls),
        }

    return {"case_id": case_id, "result": "FAIL", "notes": "unknown agent fixture"}


class TestToolGoldenFixtures(unittest.TestCase):
    def test_all_discovered_fixtures_pass(self):
        self.assertTrue(os.path.isdir(_FIXTURES_DIR), "fixtures dir missing: " + _FIXTURES_DIR)
        fixture_paths = sorted(Path(_FIXTURES_DIR).glob("GF-TOOL-*.json"))
        self.assertGreaterEqual(len(fixture_paths), 12, "expected at least 12 GF-TOOL fixtures on disk")
        failed = []
        for p in fixture_paths:
            fx = json.loads(p.read_text(encoding="utf-8"))
            result = _run_fixture(fx)
            if result["result"] != "PASS":
                failed.append(result)
        self.assertEqual([], failed, "failing fixtures: " + json.dumps(failed, ensure_ascii=False, default=str))


if __name__ == "__main__":
    unittest.main()
