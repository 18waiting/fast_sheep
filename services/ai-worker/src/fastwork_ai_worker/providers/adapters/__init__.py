"""Protocol adapters (TASK-019 M4).

Adapters are pure-data builders/normalizers.  They never import HTTP client libraries,
HTTP client libraries or network transports (M4 protocol serialization is data-only).
"""
from __future__ import annotations

import json
from typing import Any, Dict, Iterable, List, Optional

from ..errors import ProviderError, invalid_response, no_content_or_tools
from ..types import (
    FINISH_REASON_ERROR,
    FINISH_REASON_STOP,
    FINISH_REASON_TOOL_CALLS,
    make_tool_call,
)

VALID_API_FORMATS = {"chat_completions", "responses", "anthropic_messages"}


def pick_config(config: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in config and config[key] is not None:
            return config[key]
    return default


def ensure_suffix(url: str, suffix: str) -> str:
    base = str(url or "").rstrip("/")
    if not base:
        return suffix
    if base.endswith(suffix):
        return base
    return base + suffix


def ensure_v1_messages(url: str) -> str:
    base = str(url or "").rstrip("/")
    if not base:
        return "/v1/messages"
    if base.endswith("/v1/messages"):
        return base
    if base.endswith("/messages"):
        return base[: -len("/messages")] + "/v1/messages"
    if base.endswith("/v1"):
        return base + "/messages"
    return base + "/v1/messages"


def system_text(messages: Iterable[Dict[str, Any]]) -> str:
    parts: List[str] = []
    for message in messages or []:
        if not isinstance(message, dict):
            continue
        if message.get("role") != "system":
            continue
        content = message.get("content", "")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and isinstance(block.get("text"), str):
                    parts.append(block["text"])
    return "\n".join(parts)


def content_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts: List[str] = []
        for block in content:
            if isinstance(block, dict):
                text = block.get("text")
                if text is not None:
                    texts.append(str(text))
            elif isinstance(block, str):
                texts.append(block)
        return "\n".join(texts)
    return str(content)


def normalize_finish_reason(value: Any, tool_calls: list) -> str:
    text = str(value or "").lower()
    mapping = {
        "tool_use": FINISH_REASON_TOOL_CALLS,
        "tool_calls": FINISH_REASON_TOOL_CALLS,
        "function_call": FINISH_REASON_TOOL_CALLS,
        "end_turn": FINISH_REASON_STOP,
        "stop": FINISH_REASON_STOP,
        "length": "length",
        "content_filter": "content_filter",
        "error": FINISH_REASON_ERROR,
    }
    if tool_calls:
        return FINISH_REASON_TOOL_CALLS
    if text in mapping:
        return mapping[text]
    return FINISH_REASON_STOP


def normalized_usage(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    return {}


def canonicalize_openai_tool_call(tool_call: Dict[str, Any], index: int) -> Dict[str, Any]:
    tool_call_id = (
        tool_call.get("id")
        or tool_call.get("tool_call_id")
        or tool_call.get("call_id")
        or f"call_{index + 1}"
    )
    raw_function = tool_call.get("function")
    function = raw_function if isinstance(raw_function, dict) else {}
    name = function.get("name") or tool_call.get("name") or ""
    arguments = function.get("arguments", tool_call.get("arguments", {}))
    return make_tool_call(str(tool_call_id), str(name), arguments)


def parse_arguments_dict(arguments: Any) -> Dict[str, Any]:
    if isinstance(arguments, dict):
        return arguments
    if isinstance(arguments, str):
        try:
            parsed = json.loads(arguments)
        except (TypeError, json.JSONDecodeError):
            return {}
        if isinstance(parsed, dict):
            return parsed
        return {"_value": parsed}
    return {}


def normalized_provider_error(raw: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    """Normalize an API error body without echoing secrets or raw stack text."""
    error = raw.get("error") if isinstance(raw, dict) else None
    if isinstance(error, dict):
        code = str(error.get("code") or error.get("type") or "provider.error")
        message = str(error.get("message") or "provider returned an error")
        category = "provider"
        retryable = bool(error.get("retryable", False))
        details = {}
        if isinstance(error.get("details"), dict):
            details = error["details"]
        out = {
            "code": code,
            "category": category,
            "message": message,
            "retryable": retryable,
            "request_id": request_id,
            "correlation_id": request_id,
        }
        if details:
            out["details"] = details
        return out
    if isinstance(error, str):
        return {
            "code": "provider.error",
            "category": "provider",
            "message": error,
            "retryable": False,
            "request_id": request_id,
            "correlation_id": request_id,
        }
    return {
        "code": "provider.invalid_response",
        "category": "provider",
        "message": "provider returned an error response",
        "retryable": False,
        "request_id": request_id,
        "correlation_id": request_id,
    }


def require_content_or_tools(text: str, tool_calls: list) -> None:
    if not text and not tool_calls:
        raise no_content_or_tools()


def ensure_not_error(raw: Dict[str, Any], request_id: str) -> None:
    if isinstance(raw, dict) and raw.get("error"):
        err = normalized_provider_error(raw, request_id)
        raise ProviderError(
            code=err["code"],
            message=err["message"],
            category=err.get("category", "provider"),
            retryable=err.get("retryable", False),
            details=err.get("details"),
        )