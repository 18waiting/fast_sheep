"""Order-state filter (TASK-018 M3).

Strict observed behavior: 未下单 removes #已下单; 已下单 removes #未下单.
Strict mode (top 10) when the input result count >= 10; the relaxed (<10)
branch is clean-room DESIGN_CONFORMANCE (GF-RAG-ORD-004).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


TAG_ORDERED = "#已下单"
TAG_NOT_ORDERED = "#未下单"


def mutual_tag(order_state: Optional[str]) -> Optional[str]:
    if order_state == "未下单":
        return TAG_ORDERED
    if order_state == "已下单":
        return TAG_NOT_ORDERED
    return None


def filter_results(results: List[Dict[str, Any]], order_state: Optional[str]) -> Dict[str, Any]:
    if not results:
        return {"kept": [], "strict_mode": False, "decision": "empty"}
    tag = mutual_tag(order_state)
    kept: List[Dict[str, Any]] = []
    for r in results:
        tags = r.get("tags") or []
        if tag is not None and tag in tags:
            continue
        kept.append(r)
    strict_mode = len(results) >= 10
    if strict_mode:
        return {"kept": kept[:10], "strict_mode": True, "top_n": 10}
    return {"kept": kept, "strict_mode": False, "decision": "relaxed_branch"}
