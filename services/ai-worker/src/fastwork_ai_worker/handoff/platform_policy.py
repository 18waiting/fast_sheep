"""Platform policy (M9, clean-room). Capability gate using the canonical six-platform matrix."""
from __future__ import annotations

from typing import Any, Dict

XIANYU_MARKERS = ("闲鱼", "xianyu")


def is_xianyu_agent(agent: str) -> bool:
    return any(marker in agent for marker in XIANYU_MARKERS)


def platform_transfer_allowed(platform: str, capabilities: Dict[str, Any]) -> bool:
    """Transfer is allowed only when the platform capability gate says so."""
    if not platform:
        return True  # unknown platform: policy engine may still decide; adapter gates execution
    caps = capabilities or {}
    if "transfer" in caps:
        return bool(caps.get("transfer"))
    # canonical matrix: xianyu transfer is reference-unsupported
    if platform == "xianyu":
        return False
    return True
