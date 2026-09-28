"""Unified Knowledge Retrieval Service (SHEEP-305, RAG Knowledge Base Infrastructure).

Single entry point for all knowledge queries. Routes to appropriate knowledge
types based on scene, then delegates to the corresponding repository.

MVP-A: Keyword retrieval via StoreKnowledgeRepository.
Phase 9: Vector retrieval, hybrid retrieval, reranking.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol, Sequence

from .knowledge_type_registry import (
    KnowledgeLayer,
    KnowledgeTypeDefinition,
    KnowledgeTypeRegistry,
    SceneType,
)


@dataclass(frozen=True)
class KnowledgeQuery:
    """A knowledge retrieval query."""
    merchant_id: str
    scene: SceneType
    keywords: Sequence[str]
    store_id: Optional[str] = None
    product_id: Optional[str] = None
    limit: int = 20


@dataclass(frozen=True)
class KnowledgeRetrievalResult:
    """Result from the unified knowledge retrieval interface."""
    entries: List[Dict[str, Any]]
    confidence: float
    retrieval_method: str  # "KEYWORD" | "VECTOR" | "HYBRID"
    searched_types: List[str]
    has_results: bool


class StoreKnowledgeRepositoryPort(Protocol):
    """Protocol for store knowledge repository (decoupled from concrete impl)."""
    def query(
        self,
        merchant_id: str,
        store_id: str,
        keywords: Optional[Sequence[str]] = None,
        knowledge_type: Optional[str] = None,
        status: str = "ACTIVE",
        limit: int = 20,
    ) -> List[Dict[str, Any]]: ...


class KnowledgeRetrievalService:
    """Unified knowledge retrieval service.

    Single entry point for all knowledge queries.
    Routes to appropriate knowledge types based on scene.
    """

    def __init__(
        self,
        registry: KnowledgeTypeRegistry,
        store_repo: StoreKnowledgeRepositoryPort,
    ) -> None:
        self._registry = registry
        self._store_repo = store_repo

    def retrieve(self, query: KnowledgeQuery) -> KnowledgeRetrievalResult:
        """Retrieve knowledge entries matching the query.

        1. Determine relevant knowledge types from scene
        2. Route to appropriate repository based on layer
        3. Merge, rank, and filter results
        """
        # 1. Get relevant knowledge types for the scene
        relevant_types = self._registry.get_types_for_scene(query.scene)
        if not relevant_types:
            return KnowledgeRetrievalResult(
                entries=[],
                confidence=0.0,
                retrieval_method="KEYWORD",
                searched_types=[],
                has_results=False,
            )

        # 2. Route to repositories and collect results
        all_entries: List[Dict[str, Any]] = []
        searched_types: List[str] = []

        for type_def in relevant_types:
            entries = self._retrieve_by_type(type_def, query)
            all_entries.extend(entries)
            searched_types.append(type_def.type)

        # 3. Merge, rank, and filter
        merged = self._merge_and_rank(all_entries, query.limit)

        return KnowledgeRetrievalResult(
            entries=merged,
            confidence=self._calculate_confidence(merged),
            retrieval_method="KEYWORD",  # MVP-A
            searched_types=searched_types,
            has_results=len(merged) > 0,
        )

    def _retrieve_by_type(
        self,
        type_def: KnowledgeTypeDefinition,
        query: KnowledgeQuery,
    ) -> List[Dict[str, Any]]:
        """Route to the appropriate repository based on layer."""
        if type_def.layer == KnowledgeLayer.STORE:
            if not query.store_id:
                return []  # Store layer requires store_id
            return self._store_repo.query(
                merchant_id=query.merchant_id,
                store_id=query.store_id,
                keywords=query.keywords,
                knowledge_type=type_def.type,
                status="ACTIVE",
                limit=query.limit,
            )
        elif type_def.layer == KnowledgeLayer.PRODUCT:
            # Phase 2: Product layer repository
            return []
        elif type_def.layer == KnowledgeLayer.MERCHANT:
            # Phase 2: Merchant layer repository
            return []
        elif type_def.layer == KnowledgeLayer.SYSTEM:
            # Phase 2: System layer repository
            return []
        elif type_def.layer == KnowledgeLayer.CONVERSATION:
            # Phase 2: Conversation context
            return []
        return []

    def _merge_and_rank(
        self,
        entries: List[Dict[str, Any]],
        limit: int,
    ) -> List[Dict[str, Any]]:
        """Merge and rank knowledge entries.

        MVP-A: Simple ranking by updated_at (most recent first).
        Phase 9: Vector similarity + reranking.
        """
        # Sort by updated_at descending (most recent first)
        sorted_entries = sorted(
            entries,
            key=lambda e: e.get("updated_at", ""),
            reverse=True,
        )
        return sorted_entries[:limit]

    def _calculate_confidence(self, entries: List[Dict[str, Any]]) -> float:
        """Calculate confidence score based on match quality.

        MVP-A: Simple heuristic based on number of results.
        Phase 9: Vector similarity scores.
        """
        if not entries:
            return 0.0
        # Simple heuristic: more results = higher confidence (capped at 1.0)
        return min(len(entries) / 10.0, 1.0)
