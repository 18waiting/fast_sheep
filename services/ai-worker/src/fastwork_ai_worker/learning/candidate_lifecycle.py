"""Learning candidate lifecycle (M10): pending queue -> knowledge_candidate."""
from __future__ import annotations

from typing import Any, Dict, List, Optional


class CandidateLifecycle:
    def __init__(self, candidate_repo: Any, pending_repo: Any):
        self._candidates = candidate_repo
        self._pending = pending_repo

    def insert_pending(self, qa: List[Dict[str, Any]], batch_id: str, product_id: str = "") -> int:
        inserted = 0
        for item in qa:
            q = str(item.get("问题") or "")
            a = str(item.get("答案") or "")
            if not q or not a:
                continue
            self._pending.upsert({"id": f"p-{batch_id}-{inserted}", "question": q, "answer": a, "product_id": product_id, "source": "learning", "origin": "LEARNED", "batch_id": batch_id, "created_at": "2026-08-16T00:00:00Z"})
            inserted += 1
        return inserted

    def to_candidate(self, pending: Dict[str, Any], origin: str) -> Optional[str]:
        cid = "c-" + str(pending.get("id") or "")[:40]
        self._candidates.insert({
            "candidate_id": cid,
            "source": pending.get("source") or "learning",
            "question": pending.get("question") or "",
            "answer": pending.get("answer") or "",
            "product_id": pending.get("product_id") or "",
            "tags": [],
            "origin": origin,
            "status": "PENDING_REVIEW",
            "frequency": None,
            "evidence": None,
        })
        return cid
