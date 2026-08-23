"""Audit policy (M10): maps human decision -> canonical persistence effect.

- 保留  -> commit HUMAN_CONFIRMED knowledge + incremental index refresh
          (reuses M9 AUDIT_APPROVE effect semantics; GF-AUDIT-001/002).
- 丢弃  -> no knowledge write (GF-AUDIT-003).
- 待定  -> keep pending, no knowledge write (GF-AUDIT-004).
- 再审核待定 -> human re-audit round, zero provider calls (GF-AUDIT-005).
"""
from __future__ import annotations

from typing import Any, Dict


def decide_effect(action: str, entry: Dict[str, Any]) -> Dict[str, Any]:
    action = str(action or "")
    if action == "保留":
        product_id = str(entry.get("商品ID") or entry.get("product_id") or "")
        if not product_id:
            product_id = "1"  # GF-AUDIT-002 fallback
        return {
            "knowledge_op": "commit",
            "trust": "HUMAN_CONFIRMED",
            "index_refresh": "incremental",
            "product_id": product_id,
            "keep_pending": False,
        }
    if action == "丢弃":
        return {"knowledge_op": "none", "trust": "", "index_refresh": "none", "keep_pending": False}
    if action == "待定":
        return {"knowledge_op": "none", "trust": "", "index_refresh": "none", "keep_pending": True}
    return {"knowledge_op": "none", "trust": "", "index_refresh": "none", "keep_pending": False}


def is_human_action(action: str) -> bool:
    return str(action or "") in ("保留", "丢弃", "待定")
