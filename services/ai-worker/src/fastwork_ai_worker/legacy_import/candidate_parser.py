"""Legacy candidate parser (M11, clean-room). 待审核 rows -> knowledge_candidates
(PENDING_REVIEW) instead of knowledge_entries (PENDING trust).
"""
from __future__ import annotations

from typing import Any, Dict, List

from .knowledge_state_mapper import import_entry_id


def map_candidates(selection_id: str, item_id: str, rows: List[Dict[str, str]], library: str = "待审核") -> List[Dict[str, Any]]:
    candidates = []
    for row in rows:
        q = row.get("问题") or row.get("question") or ""
        a = row.get("答案") or row.get("answer") or ""
        pid = row.get("商品ID") or row.get("product_id") or ""
        if not q or not a:
            continue
        cid = "c-" + import_entry_id(selection_id, item_id, library, q, a, pid)[:40]
        candidates.append({
            "candidate_id": cid,
            "source": "legacy_import",
            "question": q,
            "answer": a,
            "product_id": pid or "",
            "tags": [str(t) for t in row.get("tags") or []] if isinstance(row.get("tags"), list) else [t for t in (row.get("标签") or "").split(",") if t],
            "origin": "LEGACY_IMPORT",
            "status": "PENDING_REVIEW",
            "frequency": None,
            "evidence": None,
        })
    return candidates
