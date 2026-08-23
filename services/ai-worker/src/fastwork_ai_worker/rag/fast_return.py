"""FastReturnPolicy (TASK-018 M3). Decision metadata only — no reply generation.

- product fast return: top product sim > product_fast_return_threshold (0.9, strict)
- completed-question fast return: sim > 0.9 AND |len(original) - len(matched)| <= 3
"""
from __future__ import annotations

from typing import Any, Dict, Optional


def product_fast_return(top_sim: float, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    threshold = float((config or {}).get("product_fast_return_threshold", 0.9))
    enabled = bool((config or {}).get("fast_return_enabled", True))
    triggered = enabled and top_sim > threshold
    if triggered:
        return {"fast_return": True}
    return {"fast_return": False, "operator": "gt"}


def completed_fast_return(
    completed_sim: float,
    len_diff: int,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    sim_threshold = float((config or {}).get("completed_fast_return_sim", 0.9))
    len_limit = int((config or {}).get("completed_fast_return_len_diff", 3))
    sim_ok = completed_sim > sim_threshold
    len_ok = abs(len_diff) <= len_limit
    if sim_ok and len_ok:
        return {"fast_return": True, "len_diff_ok": True, "operator": "lte"}
    if not len_ok:
        return {"fast_return": False, "reason": "len_diff_exceeded"}
    return {"fast_return": False, "reason": "similarity_below_threshold"}
