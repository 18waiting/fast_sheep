"""Provider response normalization (TASK-019 M4).

Converts raw adapter responses into either a GenerationResult or a normalized
error envelope.  Pure data only.
"""
from __future__ import annotations

from typing import Any, Dict

from .adapters import anthropic_messages, ark, chat_completions, responses, siliconflow
from .errors import ProviderError, config_error
from .types import VALID_PROTOCOLS


_ADAPTERS = {
    "chat_completions": chat_completions,
    "responses": responses,
    "anthropic_messages": anthropic_messages,
    "doubao_ark": ark,
    "siliconflow": siliconflow,
}


def normalize(raw: Dict[str, Any], protocol: str, request_id: str) -> Dict[str, Any]:
    """Normalize a raw provider response.

    Returns ``{"ok": True, "result": GenerationResult, "error": None}`` on
    success, or ``{"ok": False, "result": None, "error": Error}`` on failure.
    """
    if protocol not in VALID_PROTOCOLS:
        err = config_error(
            f"unknown provider protocol: {protocol!r}",
            code="unknown_protocol",
            retryable=False,
        )
        return {"ok": False, "result": None, "error": err.to_dict()}

    adapter = _ADAPTERS[protocol]
    try:
        parsed = adapter.parse_response(raw, request_id)
        result = {
            "request_id": request_id,
            "text": parsed.get("text", ""),
            "tool_calls": parsed.get("tool_calls", []),
            "finish_reason": parsed.get("finish_reason", "stop"),
            "usage": parsed.get("usage") or {},
        }
        if isinstance(raw, dict) and raw.get("model") is not None:
            result["model"] = raw.get("model")
        if parsed.get("provider") is not None:
            result["provider"] = parsed.get("provider")
        return {"ok": True, "result": result, "error": None}
    except ProviderError as exc:
        return {"ok": False, "result": None, "error": exc.to_dict()}