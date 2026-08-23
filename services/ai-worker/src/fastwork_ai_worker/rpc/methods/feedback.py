"""Feedback RPC methods (M9). feedback.apply / feedback.retry — narrow, schema-validated."""
from __future__ import annotations

from typing import Any, Dict

from ...feedback.knowledge_feedback_service import KnowledgeFeedbackService
from ...feedback.types import FeedbackApplyRequest
from ...feedback.errors import FeedbackError
from .. import protocol as rpc_protocol
from ...persistence import open_worker_db, KnowledgeRepository  # type: ignore


class FeedbackMethods:
    def __init__(self, server: Any):
        self._server = server
        self._service: KnowledgeFeedbackService | None = None

    def register(self, dispatcher: Any) -> None:
        dispatcher.register("feedback.apply", self.apply)
        dispatcher.register("feedback.retry", self.retry)

    def _get_service(self) -> KnowledgeFeedbackService:
        if self._service is None:
            import os
            from ...feedback.index_refresh_port import NoopIndexRefreshPort
            conn = open_worker_db(os.environ.get("FASTWORK_DATA_DIR", ""))
            repo = KnowledgeRepository(conn)
            self._service = KnowledgeFeedbackService(repo, NoopIndexRefreshPort())
        return self._service

    async def apply(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        ok, errs = rpc_protocol.validate_rpc_envelope("fastwork:feedback:feedback-apply-request", payload)
        if not ok:
            raise FeedbackError("feedback.invalid_request", "; ".join(errs))
        result = self._get_service().apply(FeedbackApplyRequest(
            record_id=str(payload.get("record_id") or ""),
            conversation_id=str(payload.get("conversation_id") or ""),
            class_name=str(payload.get("class") or "AUTO"),
            trust_level=str(payload.get("trust_level") or ""),
            question=str(payload.get("question") or ""),
            answer=str(payload.get("answer") or ""),
            product_id=str(payload.get("product_id") or ""),
            entry=dict(payload.get("entry") or {}),
            created_at=str(payload.get("created_at") or ""),
            retry=bool(payload.get("retry") or False),
        ))
        if not result.ok:
            raise FeedbackError("feedback.apply_failed", result.error or "unknown")
        return {
            "record_id": result.record_id,
            "ok": True,
            "knowledge_op": result.knowledge_op,
            "entry_id": result.entry_id,
            "index_refresh": result.index_refresh,
            "applied": result.applied,
        }

    async def retry(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        ok, errs = rpc_protocol.validate_rpc_envelope("fastwork:feedback:feedback-retry-request", payload)
        if not ok:
            raise FeedbackError("feedback.invalid_request", "; ".join(errs))
        return await self.apply({**req, "payload": {**payload, "retry": True}})
