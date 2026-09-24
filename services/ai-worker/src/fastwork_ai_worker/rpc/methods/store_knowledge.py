"""Store Knowledge RPC methods (SHEEP-305 MVP-A): store_knowledge.query / store_knowledge.list.

Minimal keyword-based retrieval for Store Knowledge (DEC-008 layer 3).
Read-only from the worker side. No vector retrieval (Phase 9).
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional, Sequence

from ...persistence.database import open_worker_db
from ...persistence.store_knowledge_repository import StoreKnowledgeRepository
from ..framing import log_stderr


def _query_store_knowledge(
    merchant_id: str,
    store_id: str,
    keywords: Optional[Sequence[str]] = None,
    knowledge_type: Optional[str] = None,
    status: str = "ACTIVE",
    limit: int = 20,
) -> List[Dict[str, Any]]:
    conn = open_worker_db()
    try:
        repo = StoreKnowledgeRepository(conn)
        return repo.query(
            merchant_id=merchant_id,
            store_id=store_id,
            keywords=keywords,
            knowledge_type=knowledge_type,
            status=status,
            limit=limit,
        )
    finally:
        conn.close()


def _list_store_knowledge(
    merchant_id: str,
    store_id: str,
    knowledge_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    conn = open_worker_db()
    try:
        repo = StoreKnowledgeRepository(conn)
        return repo.list(
            merchant_id=merchant_id,
            store_id=store_id,
            knowledge_type=knowledge_type,
            status=status,
            limit=limit,
        )
    finally:
        conn.close()


class StoreKnowledgeMethods:
    def __init__(self, server) -> None:
        self._server = server

    def register(self, dispatcher) -> None:
        dispatcher.register("store_knowledge.query", self.query)
        dispatcher.register("store_knowledge.list", self.list)

    async def query(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        merchant_id = payload.get("merchant_id")
        store_id = payload.get("store_id")
        if not merchant_id or not store_id:
            return {"ok": False, "error": "merchant_id and store_id are required", "entries": []}

        keywords = payload.get("keywords")
        knowledge_type = payload.get("knowledge_type")
        status = payload.get("status", "ACTIVE")
        limit = min(int(payload.get("limit", 20)), 100)

        try:
            entries = await asyncio.to_thread(
                _query_store_knowledge,
                merchant_id,
                store_id,
                keywords,
                knowledge_type,
                status,
                limit,
            )
            return {"ok": True, "entries": entries, "count": len(entries)}
        except Exception as e:
            log_stderr(f"store_knowledge.query error: {e}")
            return {"ok": False, "error": str(e), "entries": []}

    async def list(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        merchant_id = payload.get("merchant_id")
        store_id = payload.get("store_id")
        if not merchant_id or not store_id:
            return {"ok": False, "error": "merchant_id and store_id are required", "entries": []}

        knowledge_type = payload.get("knowledge_type")
        status = payload.get("status")
        limit = min(int(payload.get("limit", 100)), 500)

        try:
            entries = await asyncio.to_thread(
                _list_store_knowledge,
                merchant_id,
                store_id,
                knowledge_type,
                status,
                limit,
            )
            return {"ok": True, "entries": entries, "count": len(entries)}
        except Exception as e:
            log_stderr(f"store_knowledge.list error: {e}")
            return {"ok": False, "error": str(e), "entries": []}
