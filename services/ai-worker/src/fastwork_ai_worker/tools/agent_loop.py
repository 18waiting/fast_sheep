"""Deterministic function-calling agent loop."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .tool_result_normalizer import normalize_result

_APOLOGY_TEXT = "抱歉，处理您的问题时遇到了一些复杂情况，请稍后再试或换个方式描述您的问题。"


class AgentLoop:
    """Run generation/tool-execution turns until a final text or a guard trips."""

    def __init__(
        self,
        generation_provider: Any,
        registry: Any,
        executor: Any,
        max_rounds: int = 5,
        dead_loop_threshold: int = 2,
        call_log: Optional[List[Any]] = None,
    ) -> None:
        self.generation_provider = generation_provider
        self.registry = registry
        self.executor = executor
        self.max_rounds = int(max_rounds)
        self.dead_loop_threshold = int(dead_loop_threshold)
        self.call_log = call_log if call_log is not None else []

    def run(self, request: Dict[str, Any]) -> Dict[str, Any]:
        request = request or {}
        messages: List[Dict[str, Any]] = list(request.get("messages") or [])
        entitlement = request.get("entitlement")

        rounds = 0
        text = ""
        terminated: Optional[str] = None
        action: Optional[str] = None
        dead_loop_guard = False
        tool_results: List[Dict[str, Any]] = []
        error_counts: Dict[str, int] = {}

        for _ in range(self.max_rounds):
            rounds += 1
            self.call_log.append(("generate", rounds))
            generation = self._generate(messages)

            tool_calls = self._tool_calls(generation)
            if not tool_calls:
                text = self._text(generation) or ""
                terminated = "finish"
                break

            for tool_call in tool_calls:
                tool_call = dict(tool_call)
                tool_call_id = tool_call.get("tool_call_id") or ("call_" + str(len(tool_results) + 1))
                tool_call["tool_call_id"] = tool_call_id

                raw = self.executor.execute(tool_call, entitlement)
                normalized = normalize_result(
                    tool_call_id,
                    bool(raw.get("ok", False)) if isinstance(raw, dict) else False,
                    result=(raw.get("result") if isinstance(raw, dict) and raw.get("result") is not None else raw) if isinstance(raw, dict) else raw,
                    error=raw.get("error") if isinstance(raw, dict) else None,
                    text=raw.get("text") if isinstance(raw, dict) else "",
                )
                tool_results.append(normalized)
                self.call_log.append(("tool", tool_call.get("name"), normalized))
                self.call_log.append(("trace", "TOOL_RESULT_APPEND"))
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": json.dumps(normalized, ensure_ascii=False, default=str),
                    }
                )

                if not normalized["ok"] and normalized["error"]:
                    signature = self._error_signature(tool_call, normalized["error"])
                    error_counts[signature] = error_counts.get(signature, 0) + 1
                    if error_counts[signature] >= self.dead_loop_threshold:
                        dead_loop_guard = True
                        action = "apology"
                        terminated = "dead_loop_guard"
                        break

            if dead_loop_guard:
                break

            self.call_log.append(("trace", "NEXT_MODEL_TURN"))

        if terminated is None:
            terminated = "max_rounds"
            if action is None:
                action = "apology"

        if dead_loop_guard or terminated == "max_rounds":
            if not text:
                text = _APOLOGY_TEXT

        return {
            "rounds": rounds,
            "text": text,
            "terminated": terminated,
            "tool_results": tool_results,
            "dead_loop_guard": dead_loop_guard,
            "action": action,
        }

    def _generate(self, messages: List[Dict[str, Any]]) -> Any:
        try:
            return self.generation_provider.generate(messages)
        except AttributeError:
            return self.generation_provider(messages)

    @staticmethod
    def _tool_calls(generation: Any) -> List[Dict[str, Any]]:
        if isinstance(generation, dict):
            calls = generation.get("tool_calls") or []
        else:
            calls = getattr(generation, "tool_calls", None) or []
        return [c for c in calls if isinstance(c, dict)]

    @staticmethod
    def _text(generation: Any) -> str:
        if isinstance(generation, dict):
            return generation.get("text") or ""
        return getattr(generation, "text", "") or ""

    @staticmethod
    def _error_signature(tool_call: Dict[str, Any], error: Dict[str, Any]) -> str:
        name = tool_call.get("name") or ""
        args_json = json.dumps(tool_call.get("arguments", {}), ensure_ascii=False, sort_keys=True, default=str)
        code = error.get("code") if isinstance(error, dict) else str(error)
        return json.dumps([name, args_json, code], ensure_ascii=False, sort_keys=True)


