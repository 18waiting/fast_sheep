"""KnowledgeFeedbackService (M9, clean-room). Worker-side knowledge effect application.

Single-writer: the WORKER is the only writer of knowledge_entries / knowledge_candidates.
NO_SAVE performs ZERO knowledge mutation and ZERO worker calls beyond the apply request.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from .effect_mapper import entry_for, map_effect
from .idempotency import FeedbackIdempotency
from .types import FeedbackApplyRequest, FeedbackApplyResult
from .index_refresh_port import IndexRefreshPort, NoopIndexRefreshPort


class KnowledgeFeedbackService:
    def __init__(self, knowledge_repository: Any, index_refresh: Optional[IndexRefreshPort] = None):
        self._repo = knowledge_repository
        self._index = index_refresh or NoopIndexRefreshPort()
        self._idem = FeedbackIdempotency()

    def apply(self, req: FeedbackApplyRequest) -> FeedbackApplyResult:
        result = FeedbackApplyResult(record_id=req.record_id, ok=False)
        if self._idem.was_applied(req.record_id):
            result.applied = False
            result.ok = True
            return result
        effect = map_effect(req)
        if effect.op == "none":
            self._idem.mark_applied(req.record_id)
            result.knowledge_op = "none"
            result.ok = True
            result.applied = True
            return result
        entry = entry_for(req, effect)
        if entry is None:
            result.error = "missing_question_or_answer"
            return result
        try:
            self._repo.upsert(entry)
            self._commit()
            if effect.index_refresh == "incremental":
                self._index.refresh("incremental")
            elif effect.index_refresh == "deferred":
                self._index.mark_rebuild()
            self._idem.mark_applied(req.record_id)
            result.ok = True
            result.applied = True
            result.knowledge_op = effect.op
            result.entry_id = entry["id"]
            result.index_refresh = effect.index_refresh
            return result
        except Exception as exc:  # noqa: BLE001
            result.error = str(exc)[:200]
            return result

    def _commit(self) -> None:
        conn = getattr(self._repo, "_conn", None)
        if conn is not None:
            try:
                conn.commit()
            except Exception:
                pass
