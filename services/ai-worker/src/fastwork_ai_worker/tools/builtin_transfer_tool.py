"""Built-in transfer-to-human tool."""
from __future__ import annotations

from typing import Any, Dict


def transfer_to_human(args: Dict[str, Any]) -> Dict[str, Any]:
    """Return a ToolResult requesting a human takeover."""
    if not isinstance(args, dict):
        args = {}
    reason = args.get("reason", "")
    return {
        "ok": True,
        "result": {
            "decision": {
                "requested": True,
                "target": "人工",
                "reason": reason,
            }
        },
        "text": "",
        "error": None,
    }


def register(registry: Any) -> None:
    """Register the transfer built-in on ``registry``."""
    registry.register_builtin(
        "转接人工客服",
        transfer_to_human,
        description="转接人工客服",
    )
