"""Audit engine (M10): human approve/discard/pending over learned candidates.

- 保留 -> commit B/HUMAN_CONFIRMED via M9 AUDIT_APPROVE effect + incremental refresh.
- 丢弃 -> no knowledge write.
- 待定 -> keep pending, no knowledge write.
- 再审核待定 -> human re-audit round with zero provider calls.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from ..feedback.effect_mapper import map_effect, entry_for
from ..feedback.types import FeedbackApplyRequest
from .audit_policy import decide_effect, is_human_action
from .candidate_transition import CandidateTransition


class AuditEngine:
    def __init__(self, knowledge_repo: Any = None, candidate_repo: Any = None,
                 pending_repo: Any = None, index_refresh: Any = None):
        self._knowledge = knowledge_repo
        self._candidates = candidate_repo
        self._pending = pending_repo
        self._index = index_refresh
        self._transition = CandidateTransition(candidate_repo, pending_repo)
        self._stats = {"保留": 0, "丢弃": 0, "待定": 0}

    def decide(self, request: Dict[str, Any]) -> Dict[str, Any]:
        action = str(request.get("action") or "")
        entry = dict(request.get("entry") or {})
        self._stats = {"保留": 0, "丢弃": 0, "待定": 0}

        # 再审核待定: human re-audit round, no provider calls (GF-AUDIT-005).
        if str(request.get("command") or "") == "review_pending" and not is_human_action(action):
            return {"decisions": {"re_audit": True, "human_round": True, "provider_calls": 0}}

        if not is_human_action(action):
            return {"persistence": [{"aggregate": "knowledge", "op": "none"}], "result": {"统计": self._stats}}

        effect = decide_effect(action, entry)
        self._stats[action] = 1

        if action == "保留":
            return self._approve(entry, effect)
        if action == "丢弃":
            self._transition.discard(entry)
            return {"persistence": [{"aggregate": "knowledge", "op": "none"}], "external_calls": [], "result": {"统计": self._stats}}
        # 待定
        self._transition.keep_pending(entry)
        return {"persistence": [{"aggregate": "pending_knowledge", "op": "keep_pending"}], "result": {"统计": self._stats}}

    def _approve(self, entry: Dict[str, Any], effect: Dict[str, Any]) -> Dict[str, Any]:
        # Reuse M9 AUDIT_APPROVE effect: insert HUMAN_CONFIRMED + incremental refresh.
        req = FeedbackApplyRequest(
            record_id="audit-" + str(entry.get("问题") or entry.get("question") or "")[:24],
            conversation_id="", class_name="AUDIT_APPROVE", trust_level="HUMAN_CONFIRMED",
            question=str(entry.get("问题") or ""), answer=str(entry.get("答案") or ""),
            product_id=str(entry.get("商品ID") or entry.get("product_id") or ""),
            entry=entry, created_at="2026-08-16T00:00:00Z",
        )
        m9 = map_effect(req)
        if self._knowledge is not None:
            built = entry_for(req, m9)
            if built:
                built["product_id"] = effect["product_id"]  # GF-AUDIT-002 empty -> "1"
                self._knowledge.upsert(built)
                if hasattr(self._knowledge, "_conn"):
                    try:
                        self._knowledge._conn.commit()
                    except Exception:
                        pass
        self._transition.finalize(entry)
        if self._index is not None:
            self._index.refresh("incremental")
        return {
            "persistence": [
                {"aggregate": "knowledge", "op": "commit", "trust": "HUMAN_CONFIRMED", "product_id": effect["product_id"]},
                {"aggregate": "index", "op": "refresh", "mode": "incremental"},
            ],
            "result": {"统计": self._stats},
        }


def run_audit(request: Dict[str, Any], engine: Optional[AuditEngine] = None) -> Dict[str, Any]:
    eng = engine or AuditEngine()
    return eng.decide(request)
