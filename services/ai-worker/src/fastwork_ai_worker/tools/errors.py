"""Tool subsystem error codes and exception types."""
from __future__ import annotations

TOOL_UNKNOWN = "tool.unknown"
TOOL_BAD_ARGUMENTS = "tool.bad_arguments"
TOOL_DISABLED = "tool.disabled"
TOOL_TIMEOUT = "tool.timeout"
TOOL_CRASHED = "tool.crashed"
TOOL_UNSIGNED = "tool.unsigned"


class ToolError(RuntimeError):
    """Structured tool error carrying a machine-readable code."""

    def __init__(self, code: str, category: str = "tool", message: str = "") -> None:
        super().__init__(message or code)
        self.code = code
        self.category = category
        self.message = message

    def to_dict(self) -> dict:
        return {"code": self.code, "category": self.category, "message": self.message}
