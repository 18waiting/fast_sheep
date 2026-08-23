"""Learning commit policy (M10): design; commits only when explicitly authorized."""
from __future__ import annotations

from typing import Any, Dict


def commit_policy(config: Dict[str, Any]) -> Dict[str, Any]:
    return {"auto_commit": bool(config.get("auto_commit", False)), "commit_to": "B库人工确认过" if config.get("auto_commit") else "PENDING_REVIEW"}
