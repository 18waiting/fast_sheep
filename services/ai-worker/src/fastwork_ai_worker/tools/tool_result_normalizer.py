"""Normalize raw tool execution output into ToolResult-shaped dictionaries."""
from __future__ import annotations

from typing import Any, Dict, Optional


def normalize_result(
    tool_call_id: str,
    ok: bool,
    result: Optional[Any] = None,
    error: Optional[Dict[str, Any]] = None,
    text: Optional[str] = None,
) -> Dict[str, Any]:
    """Return the canonical clean-room ToolResult shape."""
    return {
        "tool_call_id": tool_call_id,
        "ok": bool(ok),
        "result": result if result is not None else {},
        "text": text if text is not None else "",
        "error": error,
    }


def error_result(
    tool_call_id: str,
    code: str,
    category: str = "tool",
    message: str = "",
) -> Dict[str, Any]:
    """Return a failed ToolResult with a structured error object."""
    return normalize_result(
        tool_call_id,
        False,
        result=None,
        error={"code": code, "category": category, "message": message},
        text=None,
    )
