"""OpenAI Responses API adapter (TASK-019 M4).

Pure data builder/normalizer.  No network clients or sockets.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from ..errors import invalid_response
from . import (
    content_text,
    ensure_not_error,
    ensure_suffix,
    normalized_provider_error,
    normalize_finish_reason,
    normalized_usage,
    make_tool_call,
    parse_arguments_dict,
    pick_config,
    require_content_or_tools,
    system_text,
)


def _convert_tools(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    converted: List[Dict[str, Any]] = []
    for tool in tools or []:
        if not isinstance(tool, dict):
            continue
        # Already Responses-shaped function tool.
        if tool.get("type") == "function" and "name" in tool:
            converted.append(tool)
            continue
        function = tool.get("function") or tool
        converted.append({"type": "function", **function})
    return converted


def _message_item(message: Dict[str, Any]) -> List[Dict[str, Any]]:
    role = message.get("role")
    content = message.get("content", "")
    tool_calls = message.get("tool_calls") or []
    tool_call_id = message.get("tool_call_id")

    if role == "tool":
        return [{
            "type": "function_call_output",
            "call_id": tool_call_id or "",
            "output": content_text(content),
        }]
    if role == "assistant" and tool_calls:
        items: List[Dict[str, Any]] = []
        if content_text(content):
            items.append({
                "type": "message",
                "role": "assistant",
                "content": [{"type": "input_text", "text": content_text(content)}],
            })
        for tc in tool_calls:
            if not isinstance(tc, dict):
                continue
            fn = tc.get("function") or tc
            items.append({
                "type": "function_call",
                "call_id": tc.get("id") or tc.get("tool_call_id") or tool_call_id or "",
                "name": tc.get("name") or fn.get("name", ""),
                "arguments": parse_arguments_dict(
                    tc.get("arguments", fn.get("arguments", {}))
                ),
            })
        return items or [{
            "type": "message",
            "role": "assistant",
            "content": [{"type": "input_text", "text": content_text(content)}],
        }]
    return [{
        "type": "message",
        "role": role or "user",
        "content": [{"type": "input_text", "text": content_text(content)}],
    }]


def build_request(
    provider_config: Dict[str, Any],
    messages: List[Dict[str, Any]],
    tools: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Build a data-only Responses API request envelope."""
    base_url = str(pick_config(provider_config, "base_url", "api_url", default=""))
    model = pick_config(provider_config, "model", "model_name", default="")
    credential_ref = provider_config.get("credential_ref") or "<credential_ref>"
    max_output_tokens = pick_config(provider_config, "max_output", "max_tokens", default=500)
    temperature = pick_config(provider_config, "temperature", default=0.3)

    url = ensure_suffix(base_url, "/responses")
    instructions = system_text(messages)
    input_items: List[Dict[str, Any]] = []
    for message in messages:
        if not isinstance(message, dict) or message.get("role") == "system":
            continue
        input_items.extend(_message_item(message))

    payload: Dict[str, Any] = {
        "model": model,
        "max_output_tokens": max_output_tokens,
        "temperature": temperature,
        "input": input_items,
    }
    if instructions:
        payload["instructions"] = instructions
    if tools:
        payload["tools"] = _convert_tools(tools)
        payload["tool_choice"] = "auto"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {credential_ref}",
    }
    return {"url": url, "headers": headers, "payload": payload}


def parse_response(raw: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    ensure_not_error(raw, request_id)
    if not isinstance(raw, dict):
        raise invalid_response("responses response must be an object")
    output = raw.get("output") or []
    if not isinstance(output, list):
        raise invalid_response("responses response has no output list")

    text_parts: List[str] = []
    tool_calls: List[Dict[str, Any]] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        item_type = item.get("type")
        if item_type == "function_call":
            call_id = item.get("call_id") or item.get("id") or f"call_{len(tool_calls) + 1}"
            name = item.get("name") or item.get("function", {}).get("name", "")
            arguments = item.get("arguments", item.get("function", {}).get("arguments", {}))
            tool_calls.append(make_tool_call(str(call_id), str(name), arguments))
        elif item_type in ("message", "output_text"):
            if item_type == "output_text":
                text_parts.append(content_text(item.get("text")).strip())
            else:
                for block in item.get("content") or []:
                    if isinstance(block, dict) and block.get("type") in ("input_text", "output_text"):
                        text_parts.append(content_text(block.get("text")).strip())
        elif item_type == "function_call_output":
            # Tool-result items are not generation tool calls; ignore here.
            continue

    text = "\n".join(text_parts).strip()
    require_content_or_tools(text, tool_calls)
    return {
        "text": text,
        "tool_calls": tool_calls,
        "finish_reason": normalize_finish_reason(raw.get("status"), tool_calls),
        "usage": normalized_usage(raw.get("usage")),
    }


def normalize_error(raw: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    return normalized_provider_error(raw, request_id)