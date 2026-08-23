"""Doubao/Ark adapter (TASK-019 M4).

Ark is OpenAI-compatible for the subset used by FastWork, so this adapter is a
small data-only specialization with the Ark base URL default.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..errors import ProviderError, invalid_response
from . import (
    canonicalize_openai_tool_call,
    content_text,
    ensure_not_error,
    ensure_suffix,
    normalized_provider_error,
    normalize_finish_reason,
    normalized_usage,
    pick_config,
    require_content_or_tools,
)


DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
DEFAULT_ARK_MODEL = "doubao-seed-1-8-251228"


def build_request(
    provider_config: Dict[str, Any],
    messages: List[Dict[str, Any]],
    tools: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Build a data-only Ark request envelope."""
    base_url = str(pick_config(provider_config, "base_url", "api_url", default=DEFAULT_ARK_BASE_URL))
    model = pick_config(provider_config, "model", "model_name", default=DEFAULT_ARK_MODEL)
    credential_ref = provider_config.get("credential_ref") or "<credential_ref>"
    max_tokens = pick_config(provider_config, "max_output", "max_tokens", default=500)
    temperature = pick_config(provider_config, "temperature", default=0.3)

    url = ensure_suffix(base_url, "/chat/completions")
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "thinking": {"type": "disabled"},
        "max_tokens": max_tokens,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {credential_ref}",
    }
    return {"url": url, "headers": headers, "payload": payload}


def parse_response(raw: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    ensure_not_error(raw, request_id)
    if not isinstance(raw, dict):
        raise invalid_response("ark response must be an object")
    choices = raw.get("choices") or []
    if not choices or not isinstance(choices, list):
        raise invalid_response("ark response has no choices")
    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message") if isinstance(first.get("message"), dict) else {}
    text = content_text(message.get("content")).strip()
    tool_calls_raw = message.get("tool_calls") or []
    tool_calls = [
        canonicalize_openai_tool_call(tc, i)
        for i, tc in enumerate(tool_calls_raw)
        if isinstance(tc, dict)
    ]
    require_content_or_tools(text, tool_calls)
    return {
        "text": text,
        "tool_calls": tool_calls,
        "finish_reason": normalize_finish_reason(first.get("finish_reason"), tool_calls),
        "usage": normalized_usage(raw.get("usage")),
    }


def normalize_error(raw: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    return normalized_provider_error(raw, request_id)