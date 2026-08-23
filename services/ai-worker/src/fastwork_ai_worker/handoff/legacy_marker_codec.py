"""Legacy marker codec (M9, clean-room). Compatibility ONLY; internal protocol stays TransferDecision."""
from __future__ import annotations

from typing import Any, Dict, Optional

MARKER = "###【转接】"


def decode_legacy_marker(reply: str) -> Optional[Dict[str, Any]]:
    """Parse `{msg}###【转接】转接给：{target}-{reason}` into a TransferDecision-shaped dict.

    Malformed markers (no target) => {requested: False}. No marker => None.
    """
    if MARKER not in reply:
        return None
    head, _, tail = reply.partition(MARKER)
    buyer_visible = head.strip()
    payload = tail.strip()
    if not payload.startswith("转接给："):
        return {"requested": False}
    rest = payload[len("转接给："):]
    if "-" not in rest:
        return {"requested": False}
    target, _, reason = rest.partition("-")
    target = target.strip()
    if not target:
        return {"requested": False}
    return {"requested": True, "target": target, "reason": reason.strip() or None, "buyer_visible": buyer_visible}


def encode_legacy_marker(message: str, target: str, reason: str) -> str:
    return f"{message}###【转接】转接给：{target}-{reason}"
