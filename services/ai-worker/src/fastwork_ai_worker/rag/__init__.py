"""M3 RAG engine foundation (TASK-018).

Deterministic, offline retrieval stack: EmbeddingProvider abstraction, FAISS
IndexIDMap2(IndexFlatIP), tiered retrieval, dedupe, rerank, order filter, fast
return. No live embedding/rerank network calls; no prompt/generation logic.
"""
from .rag_engine import RAGEngine
from .config import load_rag_config, DEFAULT_RAG_CONFIG

__all__ = ["RAGEngine", "load_rag_config", "DEFAULT_RAG_CONFIG"]
