"""Learning RPC methods (M10). learning.run — narrow production surface."""
from __future__ import annotations

from typing import Any, Dict

from ...learning.learning_engine import LearningEngine
from ...learning.errors import LearningError
from .. import protocol as rpc_protocol


class LearningMethods:
    def __init__(self, server: Any):
        self._server = server
        self._engine: LearningEngine | None = None

    def register(self, dispatcher: Any) -> None:
        dispatcher.register("learning.run", self.run)

    def _get_engine(self) -> LearningEngine:
        if self._engine is None:
            import os
            from ...persistence import open_worker_db, KnowledgeCandidateRepository
            from ...rag.mock_embedding_provider import MockEmbeddingProvider
            from ...providers.mock_generation_provider import MockGenerationProvider
            self._engine = LearningEngine(
                pending_repo=_PendingKnowledgeStore(os.environ.get("FASTWORK_DATA_DIR", "")),
                candidate_repo=KnowledgeCandidateRepository(open_worker_db(os.environ.get("FASTWORK_DATA_DIR", ""))),
                embedding_provider=MockEmbeddingProvider(1024),
                generation_provider=MockGenerationProvider(scenarios=[]),
            )
        return self._engine

    async def run(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        ok, errs = rpc_protocol.validate_rpc_envelope("fastwork:learning:learning-run-request", payload)
        if not ok:
            raise LearningError("learning.invalid_request", "; ".join(errs))
        return self._get_engine().run(payload)


class _PendingKnowledgeStore:
    """Lightweight pending_knowledge writer (0003 table)."""
    def __init__(self, data_root: str):
        self._data_root = data_root

    def upsert(self, entry: Dict[str, Any]) -> None:
        import os
        import sqlite3
        conn = sqlite3.connect(os.path.join(self._data_root, "fast_sheep.sqlite3"))
        try:
            conn.execute(
                "INSERT OR REPLACE INTO pending_knowledge (id, question, answer, product_id, source, origin, batch_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (entry["id"], entry["question"], entry["answer"], entry.get("product_id", ""), entry.get("source", ""), entry.get("origin", "LEARNED"), entry.get("batch_id", ""), entry.get("created_at", "")),
            )
            conn.commit()
        finally:
            conn.close()
