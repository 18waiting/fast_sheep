"""Sandboxed tool executor."""
from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, Optional

from .tool_registry import ToolRegistry
from .types import ToolDefinition
from .sandbox.policy import SandboxPolicy
from .sandbox.process_runner import run_process

_BAD_ARGUMENTS = object()


class ToolExecutor:
    """Execute ToolCall-shaped dicts against a registry."""

    def __init__(self, registry: Optional[ToolRegistry] = None, sandbox_config: Optional[Dict[str, Any]] = None) -> None:
        self.registry = registry if registry is not None else ToolRegistry()
        merged: Dict[str, Any] = {
            "network": False,
            "data_read_only": True,
            "timeout_ms": 5000,
            "output_limit": 65536,
            "allow_unsigned": False,
        }
        if sandbox_config:
            merged.update(sandbox_config)
        self.sandbox_config = merged
        self.call_log = []
        self.policy = SandboxPolicy(
            network=merged.get("network", False),
            data_read_only=merged.get("data_read_only", True),
            timeout_ms=merged.get("timeout_ms", 5000),
            output_limit=merged.get("output_limit", 65536),
            allow_unsigned=merged.get("allow_unsigned", False),
        )

    def execute(self, tool_call: Dict[str, Any], entitlement: Optional[Any] = None) -> Dict[str, Any]:
        if not isinstance(tool_call, dict):
            return self._error("tool.bad_arguments", message="tool_call must be a dict")

        name = tool_call.get("name") or ""
        arguments = self._parse_arguments(tool_call.get("arguments", {}))
        if arguments is _BAD_ARGUMENTS:
            return self._error("tool.bad_arguments", message="arguments must be valid JSON")

        definition = self.registry.get(name) if hasattr(self.registry, "get") else None
        if definition is None:
            return self._error("tool.unknown", message="unknown tool: " + name)

        if self._disabled(definition, entitlement):
            return self._error("tool.disabled", message="tool disabled: " + name)
        self.call_log.append(("tool", name))

        handler = getattr(self.registry, "get_handler", lambda n: None)(name)
        if handler is not None:
            try:
                result = handler(arguments)
            except Exception as exc:  # noqa: BLE001
                return self._error("tool.crashed", message=str(exc))
            return self._success_dict(result, name, arguments)

        if self._is_query(definition):
            return self._run_query(definition, arguments)
        return self._run_instruction(definition, arguments)

    @staticmethod
    def _success_dict(result: Any, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(result, dict):
            return {
                "ok": True,
                "action": name,
                "parameters": arguments,
                "text": "" if result is None else str(result),
            }
        out = dict(result)
        out.setdefault("ok", True)
        return out

    @staticmethod
    def _error(code: str, category: str = "tool", message: str = "") -> Dict[str, Any]:
        return {"ok": False, "error": {"code": code, "category": category, "message": message}}

    @staticmethod
    def _parse_arguments(arguments: Any) -> Any:
        if arguments is None:
            return {}
        if isinstance(arguments, dict):
            return arguments
        if isinstance(arguments, str):
            text = arguments.strip()
            if not text:
                return {}
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                return _BAD_ARGUMENTS
            if isinstance(parsed, dict):
                return parsed
            return {"value": parsed}
        if isinstance(arguments, (list, tuple)):
            return {"value": list(arguments)}
        return {"value": arguments}

    @staticmethod
    def _is_query(definition: ToolDefinition) -> bool:
        run = definition.run or {}
        return definition.skill_type in ("query", "script") or bool(run.get("command"))

    def _disabled(self, definition: ToolDefinition, entitlement: Any) -> bool:
        if not definition.enabled:
            return True
        disabled: Any = []
        if isinstance(entitlement, dict):
            disabled = entitlement.get("disabled", [])
        elif entitlement is not None and hasattr(entitlement, "disabled"):
            disabled = getattr(entitlement, "disabled", [])
        elif isinstance(entitlement, (list, tuple, set)):
            disabled = entitlement
        if isinstance(disabled, str):
            disabled = [disabled]
        try:
            return definition.name in disabled
        except TypeError:
            return False

    def _run_instruction(self, definition: ToolDefinition, arguments: Dict[str, Any]) -> Dict[str, Any]:
        if isinstance(definition.body, dict):
            out = dict(definition.body)
            out.setdefault("ok", True)
            return out
        return {
            "ok": True,
            "action": definition.name,
            "parameters": arguments,
            "text": definition.body or "",
        }

    def _run_query(self, definition: ToolDefinition, arguments: Dict[str, Any]) -> Dict[str, Any]:
        run = definition.run or {}
        command = run.get("command")
        if not command:
            return self._run_instruction(definition, arguments)

        runtime = run.get("runtime") or self.sandbox_config.get("runtime") or "python"
        timeout_ms = int(run.get("timeout_ms", self.sandbox_config.get("timeout_ms", 5000)))
        workdir = run.get("workdir") or run.get("cwd") or self.sandbox_config.get("workdir")
        env_whitelist = run.get("env_whitelist") or self.sandbox_config.get("env_whitelist")

        argv = self._build_argv(runtime, command, arguments)
        sandbox_result = run_process(
            argv,
            timeout_ms=timeout_ms,
            env_whitelist=env_whitelist,
            workdir=workdir,
        )
        if sandbox_result.timed_out or sandbox_result.error == "tool.timeout":
            return self._error("tool.timeout", message="tool timed out")
        if not sandbox_result.ok or sandbox_result.error == "tool.crashed":
            return self._error(
                "tool.crashed",
                message=(sandbox_result.stderr or sandbox_result.stdout or "").strip()[:2000],
            )
        stdout = (sandbox_result.stdout or "").strip()
        if not stdout:
            return {"ok": True, "text": ""}
        try:
            parsed = json.loads(stdout)
        except json.JSONDecodeError:
            return {"ok": True, "text": stdout}
        if isinstance(parsed, dict):
            out = dict(parsed)
            out.setdefault("ok", True)
            return out
        return {"ok": True, "text": stdout}

    def _build_argv(self, runtime: str, command: str, arguments: Dict[str, Any]) -> list:
        args_json = json.dumps(arguments, ensure_ascii=False, sort_keys=True)
        if runtime in ("python", "python3", "py"):
            executable = sys.executable
        elif runtime == "node":
            executable = "node"
        else:
            executable = runtime
        return [executable, command, args_json]


