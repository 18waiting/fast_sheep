"""Unified Knowledge Retrieval RPC method (SHEEP-305, RAG Knowledge Base Infrastructure).

Exposes the unified knowledge retrieval service via JSON-RPC.
Method: knowledge.retrieve
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict

from ...knowledge.knowledge_type_registry import KnowledgeTypeRegistry, SceneType
from ...knowledge.knowledge_retrieval_service import (
    KnowledgeQuery,
    KnowledgeRetrievalService,
)
from ...persistence.database import open_worker_db
from ...persistence.store_knowledge_repository import StoreKnowledgeRepository
from ..framing import log_stderr


# Module-level singleton (initialized lazily)
_registry: KnowledgeTypeRegistry | None = None
_service: KnowledgeRetrievalService | None = None


def _get_service() -> KnowledgeRetrievalService:
    """Get or create the singleton retrieval service."""
    global _registry, _service
    if _service is None:
        _registry = KnowledgeTypeRegistry()
        conn = open_worker_db()
        store_repo = StoreKnowledgeRepository(conn)
        _service = KnowledgeRetrievalService(_registry, store_repo)
    return _service


async def _retrieve_knowledge(
    merchant_id: str,
    scene: str,
    keywords: list[str] | None = None,
    store_id: str | None = None,
    product_id: str | None = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """Retrieve knowledge using the unified service."""
    service = _get_service()

    # Validate scene
    try:
        scene_enum = SceneType(scene)
    except ValueError:
        return {
            "ok": False,
            "error": f"Unknown scene: {scene}. Valid scenes: {[s.value for s in SceneType]}",
            "result": None,
        }

    query = KnowledgeQuery(
        merchant_id=merchant_id,
        scene=scene_enum,
        keywords=keywords or [],
        store_id=store_id,
        product_id=product_id,
        limit=min(limit, 100),
    )

    result = service.retrieve(query)
    return {
        "ok": True,
        "result": {
            "entries": result.entries,
            "confidence": result.confidence,
            "retrieval_method": result.retrieval_method,
            "searched_types": result.searched_types,
            "has_results": result.has_results,
            "count": len(result.entries),
        },
    }


class KnowledgeRetrievalMethods:
    """RPC methods for unified knowledge retrieval."""

    def __init__(self, server: Any) -> None:
        self._server = server

    def register(self, dispatcher: Any) -> None:
        dispatcher.register("knowledge.retrieve", self.retrieve)
        dispatcher.register("knowledge.list_types", self.list_types)

    async def retrieve(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """knowledge.retrieve — unified knowledge retrieval."""
        payload = req.get("payload") or {}
        merchant_id = payload.get("merchant_id")
        scene = payload.get("scene")
        if not merchant_id or not scene:
            return {
                "ok": False,
                "error": "merchant_id and scene are required",
                "result": None,
            }

        keywords = payload.get("keywords")
        store_id = payload.get("store_id")
        product_id = payload.get("product_id")
        limit = min(int(payload.get("limit", 20)), 100)

        try:
            return await asyncio.to_thread(
                _retrieve_knowledge_sync,
                merchant_id, scene, keywords, store_id, product_id, limit,
            )
        except Exception as e:
            log_stderr(f"knowledge.retrieve error: {e}")
            return {"ok": False, "error": str(e), "result": None}

    async def list_types(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """knowledge.list_types — list all registered knowledge types."""
        try:
            registry = KnowledgeTypeRegistry()
            types = [
                {
                    "type": t.type,
                    "display_name": t.display_name,
                    "layer": t.layer.value,
                    "scenes": [s.value for s in t.scenes],
                    "active": t.active,
                    "description": t.description,
                }
                for t in registry.get_all_types()
            ]
            return {"ok": True, "types": types, "count": len(types)}
        except Exception as e:
            log_stderr(f"knowledge.list_types error: {e}")
            return {"ok": False, "error": str(e), "types": []}


def _retrieve_knowledge_sync(
    merchant_id: str,
    scene: str,
    keywords: list[str] | None,
    store_id: str | None,
    product_id: str | None,
    limit: int,
) -> Dict[str, Any]:
    """Synchronous retrieval (runs in thread pool)."""
    service = _get_service()

    # Validate scene
    try:
        scene_enum = SceneType(scene)
    except ValueError:
        return {
            "ok": False,
            "error": f"Unknown scene: {scene}. Valid scenes: {[s.value for s in SceneType]}",
            "result": None,
        }

    query = KnowledgeQuery(
        merchant_id=merchant_id,
        scene=scene_enum,
        keywords=keywords or [],
        store_id=store_id,
        product_id=product_id,
        limit=limit,
    )

    result = service.retrieve(query)
    return {
        "ok": True,
        "result": {
            "entries": result.entries,
            "confidence": result.confidence,
            "retrieval_method": result.retrieval_method,
            "searched_types": result.searched_types,
            "has_results": result.has_results,
            "count": len(result.entries),
        },
    }
