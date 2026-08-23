"""Internal provider subsystem types and small factories (TASK-019 M4).

The wire shapes live in the clean-room contracts package; these helpers keep the
provider modules honest without re-implementing the schema validator.
"""
from __future__ import annotations

import json
from typing import Any, Dict, Optional

# Protocol names used by the provider layer.
PROTOCOL_CHAT_COMPLETIONS = "chat_completions"
PROTOCOL_RESPONSES = "responses"
PROTOCOL_ANTHROPIC_MESSAGES = "anthropic_messages"
PROTOCOL_DOUBAO_ARK = "doubao_ark"
PROTOCOL_SILICONFLOW = "siliconflow"

VALID_PROTOCOLS = {
    PROTOCOL_CHAT_COMPLETIONS,
    PROTOCOL_RESPONSES,
    PROTOCOL_ANTHROPIC_MESSAGES,
    PROTOCOL_DOUBAO_ARK,
    PROTOCOL_SILICONFLOW,
}

# api_format is the OpenAI-compatible dispatcher selection field.
VALID_API_FORMATS = {
    PROTOCOL_CHAT_COMPLETIONS,
    PROTOCOL_RESPONSES,
    PROTOCOL_ANTHROPIC_MESSAGES,
}

FINISH_REASON_STOP = "stop"
FINISH_REASON_LENGTH = "length"
FINISH_REASON_TOOL_CALLS = "tool_calls"
FINISH_REASON_CONTENT_FILTER = "content_filter"
FINISH_REASON_ERROR = "error"

VALID_FINISH_REASONS = {
    FINISH_REASON_STOP,
    FINISH_REASON_LENGTH,
    FINISH_REASON_TOOL_CALLS,
    FINISH_REASON_CONTENT_FILTER,
    FINISH_REASON_ERROR,
}


def make_error(
    code: str,
    category: str,
    message: str,
    retryable: bool = False,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Return the canonical error envelope (fastwork:error)."""
    out: Dict[str, Any] = {
        "code": code,
        "category": category,
        "message": message,
        "retryable": retryable,
    }
    if details:
        out["details"] = details
    return out


def make_tool_call(tool_call_id: str, name: str, arguments: Any) -> Dict[str, Any]:
    """Return a canonical ToolCall.

    ``arguments`` is kept as an object when possible.  A malformed JSON string is
    still returned as a tool call, with an ``error`` flag instead of discarding
    the round-trip signal.
    """
    call: Dict[str, Any] = {"tool_call_id": tool_call_id, "name": name}
    if isinstance(arguments, str):
        try:
            parsed = json.loads(arguments)
        except (TypeError, json.JSONDecodeError):
            call["arguments"] = {}
            call["error"] = "malformed_tool_arguments"
            return call
        if isinstance(parsed, dict):
            call["arguments"] = parsed
        else:
            # Canonical ToolCall.arguments must be an object.  Preserve the
            # non-object value as a single named field.
            call["arguments"] = {"_value": parsed}
    elif isinstance(arguments, dict):
        call["arguments"] = arguments
    else:
        call["arguments"] = {"_value": arguments}
    return call


def make_generation_result(
    request_id: str,
    text: str,
    finish_reason: str,
    tool_calls: Optional[list] = None,
    usage: Optional[Dict[str, Any]] = None,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "request_id": request_id,
        "text": text,
        "tool_calls": list(tool_calls or []),
        "finish_reason": finish_reason,
        "usage": dict(usage or {}),
    }
    if provider is not None:
        result["provider"] = provider
    if model is not None:
        result["model"] = model
    return result


def empty_route_result() -> Dict[str, Any]:
    """ProviderRouteResult with every optional field present and null."""
    return {
        "provider": None,
        "protocol": None,
        "model": None,
        "model_ref": None,
        "multiplier": None,
        "tools": None,
        "downgrade": None,
        "selected": None,
        "fallback": None,
        "error": None,
        "trace": [],
    }