"""RAG Knowledge Base Infrastructure (SHEEP-305).

Unified knowledge retrieval with type registry and scene-based routing.
Aligned with DEC-008 (Layered Knowledge Architecture).
"""
from .knowledge_type_registry import (
    KnowledgeLayer,
    SceneType,
    KnowledgeTypeDefinition,
    KnowledgeTypeRegistry,
    BUILTIN_KNOWLEDGE_TYPES,
)
from .knowledge_retrieval_service import (
    KnowledgeQuery,
    KnowledgeRetrievalResult,
    KnowledgeRetrievalService,
)

__all__ = [
    # Types
    "KnowledgeLayer",
    "SceneType",
    "KnowledgeTypeDefinition",
    "KnowledgeQuery",
    "KnowledgeRetrievalResult",
    # Registry
    "KnowledgeTypeRegistry",
    "BUILTIN_KNOWLEDGE_TYPES",
    # Service
    "KnowledgeRetrievalService",
]
