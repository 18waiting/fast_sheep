"""Anthropic Messages API adapter (TASK-019 M4).

Pure data builder/normalizer.  No network clients or sockets.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..errors import invalid_response
from . import (
    content_text,
    ensure_not_error,
    ensure_v1_messages,
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
        if tool.get("type") == "function" and "name" in tool:
            converted.append(tool)
            continue
        function = tool.get("function") or tool
        name = function.get("name", "")
        description = function.get("description", "")
        parameters = function.get("parameters", {})
        converted.append(
            {
                "name": name,
                "description": description,
                "input_schema": parameters,
            }
        )
    return converted


def _message_content(message: Dict[str, Any]) -> List[Dict[str, Any]]:
    role = message.get("role")
    content = message.get("content", "")
    tool_calls = message.get("tool_calls") or []
    tool_call_id = message.get("tool_call_id")

    if role == "tool":
        return [
            {
                "type": "tool_result",
                "tool_use_id": tool_call_id or "",
                "content": content_text(content),
            }
        ]
    if role == "assistant" and tool_calls:
        blocks: List[Dict[str, Any]] = []
        text = content_text(content)
        if text:
            blocks.append({"type": "text", "text": text})
        for tc in tool_calls:
            if not isinstance(tc, dict):
                continue
            fn = tc.get("function") or tc
            blocks.append(
                {
                    "type": "tool_use",
                    "id": tc.get("id") or tc.get("tool_call_id") or tool_call_id or "",
                    "name": fn.get("name", ""),
                    "input": parse_arguments_dict(fn.get("arguments", tc.get("arguments", {}))),
                }
            )
        return blocks
    return [{"type": "text", "text": content_text(content)}]


def build_request(
    provider_config: Dict[str, Any],
    messages: List[Dict[str, Any]],
    tools: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Build a data-only Anthropic Messages request envelope."""
    base_url = str(pick_config(provider_config, "base_url", "api_url", default=""))
    model = pick_config(provider_config, "model", "model_name", default="")
    credential_ref = provider_config.get("credential_ref") or "<credential_ref>"
    max_tokens = pick_config(provider_config, "max_output", "max_tokens", default=500)
    temperature = pick_config(provider_config, "temperature", default=0.3)

    url = ensure_v1_messages(base_url)
    system_prompt = system_text(messages)
    converted_messages: List[Dict[str, Any]] = []
    for message in messages or []:
        if not isinstance(message, dict):
            continue
        if message.get("role") == "system":
            continue
        converted_messages.append(
            {"role": message.get("role") or "user", "content": _message_content(message)}
        )

    payload: Dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": converted_messages,
    }
    if system_prompt:
        payload["system"] = system_prompt
    if tools:
        payload["tools"] = _convert_tools(tools)

    headers = {
        "Content-Type": "application/json",
        "x-api-key": credential_ref,
        "anthropic-version": "2023-06-01",
    }
    return {"url": url, "headers": headers, "payload": payload}


def parse_response(raw: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    ensure_not_error(raw, request_id)
    if not isinstance(raw, dict):
        raise invalid_response("anthropic_messages response must be an object")
    content_blocks = raw.get("content") or []
    if not isinstance(content_blocks, list):
        raise invalid_response("anthropic_messages response has no content list")

    text_parts: List[str] = []
    tool_calls: List[Dict[str, Any]] = []
    for i, block in enumerate(content_blocks):
        if not isinstance(block, dict):
            continue
        block_type = block.get("type")
        if block_type == "text":
            text_parts.append(content_text(block.get("text")).strip())
        elif block_type == "tool_use":
            tool_calls.append(
                make_tool_call(str(block.get("id") or f"call_{i + 1}"), str(block.get("name", "")), block.get("input", {}))
            )

    text = "\n".join(text_parts).strip()
    require_content_or_tools(text, tool_calls)
    return {
        "text": text,
        "tool_calls": tool_calls,
        "finish_reason": normalize_finish_reason(raw.get("stop_reason"), tool_calls),
        "usage": normalized_usage(raw.get("usage")),
    }


def normalize_error(raw: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    return normalized_provider_error(raw, request_id)