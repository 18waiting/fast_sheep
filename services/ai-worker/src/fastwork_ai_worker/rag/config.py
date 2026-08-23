"""RAGConfig loading/validation (TASK-018 M3).

Single canonical Python defaults mirroring schemas/config/rag-config.schema.json.
No duplicate uncontrolled magic numbers elsewhere: every module reads from the
config object produced here.
"""
from __future__ import annotations

from typing import Any, Dict

from .errors import invalid_request

# Single source of default values (mirrors the canonical JSON Schema defaults).
DEFAULT_RAG_CONFIG: Dict[str, Any] = {
    "embedding_dim": 1024,
    "metric": "cosine",
    "product_search_top_k": 15,
    "product_quality_threshold": 0.6,
    "product_fast_return_threshold": 0.9,
    "completed_fast_return_sim": 0.9,
    "completed_fast_return_len_diff": 3,
    "rerank_high_similarity_skip": 0.85,
    "rerank_skip_candidate_count": 3,
    "rerank_candidate_limit": 20,
    "similarity_weight": 0.4,
    "rerank_weight": 0.6,
    "raw_protection_threshold": 0.7,
    "low_rerank_penalty": 0.1,
    "composite_clamp": 1.0,
    "reference_top_n": 10,
    # DESIGN fields (not reference behavior)
    "product_isolation": False,
    "fast_return_enabled": True,
    "index_cache_size": 16,
    "build_batch_size": 64,
    "global_search_multiplier": 2,
    "min_search_score": 0.02,
    "rerank_document_max_chars": 500,
}


def load_rag_config(payload: Dict[str, Any] | None) -> Dict[str, Any]:
    """Merge a RAGConfig payload over canonical defaults.

    Unknown keys are ignored (forward-compatible); no magic-number drift.
    """
    cfg: Dict[str, Any] = dict(DEFAULT_RAG_CONFIG)
    if payload:
        cfg.update({k: v for k, v in payload.items() if k in DEFAULT_RAG_CONFIG})
    return cfg


def normalize_config(payload: Dict[str, Any] | None) -> Dict[str, Any]:
    """Alias used by RPC/engine entry points."""
    return load_rag_config(payload)


def require_config(payload: Dict[str, Any] | None) -> Dict[str, Any]:
    cfg = load_rag_config(payload)
    if not isinstance(cfg.get("embedding_dim"), int) or cfg["embedding_dim"] <= 0:
        raise invalid_request("embedding_dim must be a positive integer")
    return cfg
