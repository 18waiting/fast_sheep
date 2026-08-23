"""RAG RPC methods (TASK-018 M3): rag.retrieve / rag.rebuild_index / rag.index_status.

Production methods (no test-mode requirement). Uses the offline deterministic
MockEmbeddingProvider (M3); production network adapters are interface-only and
belong to a later provider task. No arbitrary file paths are exposed.
"""
from __future__ import annotations

import asyncio
import json
import threading
from typing import Any, Dict, Optional

from ...persistence.database import open_worker_db, resolve_data_root
from ...persistence.knowledge_repository import KnowledgeRepository
from .. import protocol as rpc_protocol
from ..framing import log_stderr
from ...rag.config import load_rag_config
from ...rag.errors import RagError, invalid_request
from ...rag.index_repository import IndexRepository
from ...rag.index_refresh import IndexRefresh
from ...rag.mock_embedding_provider import MockEmbeddingProvider
from ...rag.rag_engine import RAGEngine

_REPO_CACHE: Dict[str, IndexRepository] = {}
_REPO_LOCK = threading.RLock()


def _data_root() -> str:
    return str(resolve_data_root())


def _knowledge_entries() -> list:
    conn = open_worker_db()
    try:
        repo = KnowledgeRepository(conn)
        # read a coherent snapshot (single SELECT; worker owns these rows)
        rows = repo.list(limit=1_000_000)
        return [dict(r) for r in rows]
    finally:
        conn.close()


def _rag_config_payload() -> Dict[str, Any]:
    try:
        conn = open_worker_db()
        try:
            row = conn.execute("SELECT payload_json FROM config_groups WHERE group_name = 'RAGConfig'").fetchone()
            if row:
                return json.loads(row["payload_json"])
        finally:
            conn.close()
    except Exception:  # noqa: BLE001 - default config on read failure
        pass
    return {}


def _repository(dimension: int) -> IndexRepository:
    key = _data_root() + "|" + str(dimension)
    with _REPO_LOCK:
        repo = _REPO_CACHE.get(key)
        if repo is None:
            repo = IndexRepository(_data_root(), config={"embedding_dim": dimension}, dimension=dimension)
            _REPO_CACHE[key] = repo
        return repo


def _engine() -> RAGEngine:
    config = load_rag_config(_rag_config_payload())
    dimension = int(config.get("embedding_dim", 1024))
    repo = _repository(dimension)
    provider = MockEmbeddingProvider(dimension=dimension)
    return RAGEngine(repo, provider, rerank_provider=None, rag_config_payload=config)


def _validate(schema_id: str, payload: Any) -> None:
    ok, errs = rpc_protocol.validate_rpc_envelope(schema_id, payload)
    if not ok:
        raise invalid_request("; ".join(errs))


class RagMethods:
    def __init__(self, server) -> None:
        self._server = server

    def register(self, dispatcher) -> None:
        dispatcher.register("rag.retrieve", self.retrieve)
        dispatcher.register("rag.rebuild_index", self.rebuild_index)
        dispatcher.register("rag.index_status", self.index_status)

    async def retrieve(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        _validate("fastwork:rag:retrieval-request", payload)
        try:
            return await asyncio.to_thread(_engine().retrieve, payload)
        except RagError as e:
            log_stderr("rag.retrieve error: " + e.code)
            raise e

    async def rebuild_index(self, req: Dict[str, Any]) -> Dict[str, Any]:
        log_stderr("rag.rebuild_index start")
        payload = req.get("payload") or {}
        _validate("fastwork:rag:rebuild-index-request", payload)
        mode = payload.get("mode", "full")
        entries = await asyncio.to_thread(_knowledge_entries)
        config = load_rag_config(_rag_config_payload())
        dimension = int(config.get("embedding_dim", 1024))
        repo = _repository(dimension)
        provider = MockEmbeddingProvider(dimension=dimension)
        refresh = IndexRefresh(repo, provider, config=config)
        data_root = _data_root()

        async def _build_in_thread():
            if mode == "precise_delete":
                entry_ids = payload.get("entry_ids") or []
                return await asyncio.to_thread(refresh.precise_delete_build, entry_ids, entries, data_root)
            if mode == "incremental":
                return await asyncio.to_thread(refresh.incremental_build, entries, data_root)
            return await asyncio.to_thread(refresh.full_build, entries, data_root)

        try:
            staging = await asyncio.wait_for(_build_in_thread(), timeout=120)
        except asyncio.TimeoutError:
            import faulthandler

            faulthandler.dump_traceback()
            raise RuntimeError("rag.rebuild_index build timed out")
        if asyncio.current_task() and asyncio.current_task().cancelling():
            raise asyncio.CancelledError()
        repo.swap_in(staging)
        log_stderr("rag.rebuild_index promoted")
        return {
            "mode": mode,
            "ok": True,
            "entry_count": len(entries),
            "product_index_count": 0,
            "global_count": 0,
            "built_at": None,
        }

    async def index_status(self, req: Dict[str, Any]) -> Dict[str, Any]:
        config = load_rag_config(_rag_config_payload())
        dimension = int(config.get("embedding_dim", 1024))
        repo = _repository(dimension)
        status = await asyncio.to_thread(repo.status)
        return {
            "ready": status.ready,
            "dimension": status.dimension,
            "metric": status.metric,
            "global_count": status.global_count,
            "product_index_count": status.product_index_count,
            "common_count": status.common_count,
            "last_build_at": status.last_build_at,
            "index_schema_version": status.index_schema_version,
            "derived_root": status.derived_root,
        }
