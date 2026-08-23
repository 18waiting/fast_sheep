"""Review/Audit/Optimization RPC methods (M10). Narrow production surface."""
from __future__ import annotations

from typing import Any, Dict, Optional

from ...review.review_engine import ReviewEngine
from ...audit.audit_engine import AuditEngine
from ...optimization.product_optimization_engine import ProductOptimizationEngine
from ...review.errors import ReviewError
from ...audit.errors import AuditError
from ...optimization.errors import OptimizationError
from .. import protocol as rpc_protocol

SCHEMAS = {
    "review.propose": "fastwork:review:review-proposal-request",
    "review.apply": "fastwork:review:review-apply-request",
    "review.restore": "fastwork:review:review-restore-request",
    "audit.decide": "fastwork:audit:audit-decision-request",
    "optimization.propose": "fastwork:optimization:product-optimization-request",
}


def _worker_db():
    import os
    from ...persistence import open_worker_db
    return open_worker_db(os.environ.get("FASTWORK_DATA_DIR", ""))


def _review_engine():
    from ...persistence import KnowledgeRepository
    from ...review.rollback_store import RollbackStore
    from ...feedback.index_refresh_port import NoopIndexRefreshPort
    conn = _worker_db()
    return ReviewEngine(
        knowledge_repo=KnowledgeRepository(conn),
        deletion_repo=_DeletionRecordStore(conn),
        rollback_store=RollbackStore(conn),
        index_refresh=NoopIndexRefreshPort(),
    ), conn


def _audit_engine():
    from ...persistence import KnowledgeRepository, KnowledgeCandidateRepository
    from ...feedback.index_refresh_port import NoopIndexRefreshPort
    conn = _worker_db()
    return AuditEngine(
        knowledge_repo=KnowledgeRepository(conn),
        candidate_repo=KnowledgeCandidateRepository(conn),
        pending_repo=_PendingStore(conn),
        index_refresh=NoopIndexRefreshPort(),
    ), conn


class _DeletionRecordStore:
    """Worker-side deletion_records writer (0003 table)."""

    def __init__(self, conn: Any):
        self._conn = conn

    def upsert(self, row: Dict[str, Any]) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO deletion_records (id, product_id, question, answer, reason, created_at) VALUES (?,?,?,?,?,?)",
            (row.get("id", ""), row.get("product_id", ""), row.get("question", ""), row.get("answer", ""), row.get("reason", ""), row.get("created_at", "")),
        )
        self._conn.commit()


class _PendingStore:
    """Worker-side pending_knowledge writer (0003 table)."""

    def __init__(self, conn: Any):
        self._conn = conn

    def upsert(self, row: Dict[str, Any]) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO pending_knowledge (id, question, answer, product_id, source, origin, batch_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (row.get("id", ""), row.get("question", ""), row.get("answer", ""), row.get("product_id", ""), row.get("source", ""), row.get("origin", "LEARNED"), row.get("batch_id", ""), row.get("created_at", "")),
        )
        self._conn.commit()


class ReviewMethods:
    def __init__(self, server: Any = None) -> None:
        self._server = server

    def register(self, dispatcher: Any) -> None:
        dispatcher.register("review.propose", self.propose)
        dispatcher.register("review.apply", self.apply)
        dispatcher.register("review.restore", self.restore)

    async def propose(self, req: Dict[str, Any]) -> Dict[str, Any]:
        return self._run("review.propose", req)

    async def apply(self, req: Dict[str, Any]) -> Dict[str, Any]:
        return self._run("review.apply", req)

    async def restore(self, req: Dict[str, Any]) -> Dict[str, Any]:
        return self._run("review.restore", req)

    def _run(self, method: str, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        ok, errs = rpc_protocol.validate_rpc_envelope(SCHEMAS[method], payload)
        if not ok:
            raise ReviewError("review.invalid_request", "; ".join(errs))
        try:
            engine, conn = _review_engine()
        except Exception:
            engine, conn = ReviewEngine(), None
        try:
            if method == "review.restore":
                return engine.restore(payload)
            if method == "review.apply":
                return engine.apply(payload)
            return engine.propose(payload)
        finally:
            if conn is not None:
                conn.close()


class AuditMethods:
    def __init__(self, server: Any = None) -> None:
        self._server = server

    def register(self, dispatcher: Any) -> None:
        dispatcher.register("audit.decide", self.decide)

    async def decide(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        ok, errs = rpc_protocol.validate_rpc_envelope(SCHEMAS["audit.decide"], payload)
        if not ok:
            raise AuditError("audit.invalid_request", "; ".join(errs))
        try:
            engine, conn = _audit_engine()
        except Exception:
            engine, conn = AuditEngine(), None
        try:
            return engine.decide(payload)
        finally:
            if conn is not None:
                conn.close()


class OptimizationMethods:
    def __init__(self, server: Any = None) -> None:
        self._server = server

    def register(self, dispatcher: Any) -> None:
        dispatcher.register("optimization.propose", self.propose)

    async def propose(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        ok, errs = rpc_protocol.validate_rpc_envelope(SCHEMAS["optimization.propose"], payload)
        if not ok:
            raise OptimizationError("optimization.invalid_request", "; ".join(errs))
        return ProductOptimizationEngine().propose(payload)
