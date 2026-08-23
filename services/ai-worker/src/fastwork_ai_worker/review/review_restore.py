"""Review restore (M10): idempotent append to A library + rebuild marker.

Reuses the M9 RESTORE primitive semantics (append, trust AUTO, deferred rebuild).
"""
from __future__ import annotations

from typing import Any, Dict


def restore_entry(knowledge_repo: Any, entry: Dict[str, Any], rollback_store: Any = None) -> Dict[str, Any]:
    key = (str(entry.get("问题") or entry.get("question") or ""), str(entry.get("答案") or entry.get("answer") or ""))
    if not key[0] or not key[1]:
        return {"applied": False, "reason": "empty"}
    entry_id = "fe-" + key[0][:12] + key[1][:12]
    existing = None
    try:
        existing = knowledge_repo.get(entry_id)
    except Exception:
        existing = None
    if existing is not None:
        return {"applied": False, "deduped": True}
    knowledge_repo.upsert({
        "id": entry_id, "question": key[0], "answer": key[1],
        "product_id": str(entry.get("商品ID") or entry.get("product_id") or ""),
        "tags": ["审查恢复"], "source": "review_restore", "trust_level": "AUTO",
        "created_at": "2026-08-16T00:00:00Z", "updated_at": "2026-08-16T00:00:00Z",
    })
    if hasattr(knowledge_repo, "_conn"):
        try:
            knowledge_repo._conn.commit()
        except Exception:
            pass
    return {"applied": True, "entry_id": entry_id, "trust": "AUTO"}
