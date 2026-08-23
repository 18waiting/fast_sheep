"""Audit candidate transition (M10): durable lifecycle transitions over candidates.

approve  -> knowledge commit (HUMAN_CONFIRMED) + candidate finalized
 discard  -> candidate DISCARDED (no knowledge)
 pending  -> candidate stays PENDING_REVIEW (no mutation)
"""
from __future__ import annotations

from typing import Any, Dict, Optional


class CandidateTransition:
    def __init__(self, candidate_repo: Any = None, pending_repo: Any = None):
        self._candidates = candidate_repo
        self._pending = pending_repo

    def finalize(self, entry: Dict[str, Any]) -> Optional[str]:
        """Approve: mark the matching candidate FINALIZED (no duplicate on repeat)."""
        if self._candidates is None:
            return None
        q = str(entry.get("问题") or entry.get("question") or "")
        cid = "c-" + q[:40] if q else None
        if cid is None:
            return None
        try:
            self._candidates.update_status(cid, "FINALIZED")
        except Exception:
            pass
        return cid

    def discard(self, entry: Dict[str, Any]) -> Optional[str]:
        if self._candidates is None:
            return None
        q = str(entry.get("问题") or entry.get("question") or "")
        cid = "c-" + q[:40] if q else None
        if cid is None:
            return None
        try:
            self._candidates.update_status(cid, "DISCARDED")
        except Exception:
            pass
        return cid

    def keep_pending(self, entry: Dict[str, Any]) -> None:
        """Pending: preserve the candidate in pending store; no knowledge write."""
        if self._pending is None:
            return
        self._pending.upsert({
            "id": "pending-" + str(entry.get("问题") or entry.get("question") or "")[:24],
            "question": str(entry.get("问题") or entry.get("question") or ""),
            "answer": str(entry.get("答案") or entry.get("answer") or ""),
            "product_id": str(entry.get("商品ID") or entry.get("product_id") or ""),
            "source": "audit", "origin": "AUDIT_PENDING", "batch_id": "audit",
            "created_at": "2026-08-16T00:00:00Z",
        })
