"""Deterministic MockGenerationProvider (TASK-019 M4).

Fingerprint requests deterministically (sha256 of messages).  Scenario keys are
the clean-room test-harness scenarios: plain text, tool calls, multiple rounds,
malformed args, no content, timeout, provider error, fallback, reasoning text,
and usage.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List, Optional

from .errors import provider_error, timeout_error
from .types import make_generation_result, make_tool_call


def fingerprint(request: Dict[str, Any]) -> str:
    messages = request.get("messages", []) if isinstance(request, dict) else []
    canonical = json.dumps(
        messages,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _normalize_error_scenario(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return {
            "code": value.get("code") or "provider.error",
            "category": value.get("category") or "provider",
            "message": value.get("message") or "mock provider error",
            "retryable": bool(value.get("retryable", False)),
        }
    return provider_error(str(value or "mock provider error")).to_dict()


class MockGenerationProvider:
    def __init__(
        self,
        scenarios=None,
        call_log: Optional[list] = None,
        error: Optional[Any] = None,
    ):
        self.scenarios = scenarios
        self.call_log = call_log if call_log is not None else []
        self.error = error
        self._next_scenario = 0

    def fingerprint(self, request: Dict[str, Any]) -> str:
        return fingerprint(request)

    def _default_scenario(self, request: Dict[str, Any]) -> Dict[str, Any]:
        messages = request.get("messages", []) if isinstance(request, dict) else []
        text = ""
        for message in reversed(messages):
            if isinstance(message, dict) and message.get("role") == "user":
                content = message.get("content", "")
                if isinstance(content, str):
                    text = content
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and isinstance(block.get("text"), str):
                            text = block["text"]
                            break
                if text:
                    break
        return {"text": text or "mock response"}

    def _resolve_scenario(self, request: Dict[str, Any]) -> Dict[str, Any]:
        if self.error is not None:
            return {"error": self.error}
        if self.scenarios is None:
            return self._default_scenario(request)
        if isinstance(self.scenarios, dict):
            fp = self.fingerprint(request)
            if fp in self.scenarios:
                return self.scenarios[fp]
            if "default" in self.scenarios:
                return self.scenarios["default"]
            return self._default_scenario(request)
        if isinstance(self.scenarios, (list, tuple)):
            if not self.scenarios:
                return self._default_scenario(request)
            idx = min(self._next_scenario, len(self.scenarios) - 1)
            self._next_scenario += 1
            return self.scenarios[idx]
        return self._default_scenario(request)

    def _scenario_error(self, scenario: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if scenario.get("timeout"):
            return timeout_error(str(scenario.get("timeout"))).to_dict()
        if scenario.get("provider_error") is not None:
            return _normalize_error_scenario(scenario.get("provider_error"))
        if scenario.get("error") is not None:
            return _normalize_error_scenario(scenario.get("error"))
        return None

    def generate(self, request: Dict[str, Any]) -> Dict[str, Any]:
        # Accept either a request dict or a bare messages list (AgentLoop compatibility).
        if isinstance(request, (list, tuple)):
            request = {"messages": list(request)}
        request = dict(request or {})
        fp = self.fingerprint(request)
        self.call_log.append(("generation", fp))
        request_id = str(request.get("request_id") or fp)

        scenario = self._resolve_scenario(request)
        if isinstance(scenario, str):
            scenario = {"text": scenario}
        if not isinstance(scenario, dict):
            scenario = {"text": ""}

        error = self._scenario_error(scenario)
        model = scenario.get("model", "mock-model")
        provider = scenario.get("provider", "mock")

        if scenario.get("no_content"):
            result = make_generation_result(
                request_id=request_id,
                text="",
                finish_reason="stop",
                tool_calls=[],
                usage=scenario.get("usage") or {},
                provider=provider,
                model=model,
            )
            result["error"] = error
            return result

        tool_calls: List[Dict[str, Any]] = []
        for i, tc in enumerate(scenario.get("tool_calls") or []):
            if isinstance(tc, str):
                tc = {"name": tc, "arguments": {}}
            if not isinstance(tc, dict):
                continue
            raw_fn = tc.get("function")
            fn = raw_fn if isinstance(raw_fn, dict) else tc
            if not isinstance(fn, dict):
                fn = {}
            name = tc.get("name") or fn.get("name") or "tool"
            arguments = tc.get("arguments", fn.get("arguments", {}))
            tool_call_id = tc.get("tool_call_id") or tc.get("id") or tc.get("call_id") or f"call_{i + 1}"
            tool_calls.append(make_tool_call(str(tool_call_id), str(name), arguments))

        text = str(scenario.get("text", ""))
        reasoning = scenario.get("reasoning_text", scenario.get("reasoning"))
        if reasoning and not text:
            text = str(reasoning)
        elif reasoning:
            text = f"{reasoning}\n{text}"

        finish_reason = scenario.get("finish_reason")
        if finish_reason is None:
            if error is not None:
                finish_reason = "error"
            elif tool_calls:
                finish_reason = "tool_calls"
            else:
                finish_reason = "stop"

        result = make_generation_result(
            request_id=request_id,
            text=text,
            finish_reason=finish_reason,
            tool_calls=tool_calls,
            usage=scenario.get("usage") or {},
            provider=provider,
            model=model,
        )
        result["error"] = error
        if scenario.get("fallback") is not None:
            result["fallback"] = scenario["fallback"]
        if reasoning:
            result["reasoning_text"] = str(reasoning)
        return result