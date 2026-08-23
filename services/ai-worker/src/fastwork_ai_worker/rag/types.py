"""Internal RAG infrastructure types (TASK-018 M3).

Only types that are NOT already canonical JSON contracts (RetrievalResult,
RAGConfig, etc. live in @fastwork/contracts).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class RawHit:
    """A raw FAISS hit resolved to its canonical knowledge entry."""

    entry_id: str
    question: str
    answer: str
    product_id: str
    source: str
    tags: List[str]
    faiss_id: int
    raw_similarity: float
    tier: str  # common | product | global


@dataclass
class RerankCandidate:
    """A candidate handed to the rerank provider with its composite score."""

    hit: RawHit
    rerank_score: float = 0.0
    composite: float = 0.0
    original_similarity: float = 0.0


@dataclass
class TieredRetrieval:
    common_hits: List[RawHit] = field(default_factory=list)
    product_hits: List[RawHit] = field(default_factory=list)
    global_hits: List[RawHit] = field(default_factory=list)
    decisions: Dict[str, Any] = field(default_factory=dict)
    tier_used: str = "none"


@dataclass
class IndexStatus:
    ready: bool
    dimension: int
    metric: str
    global_count: int
    product_index_count: int
    common_count: int
    last_build_at: Optional[str]
    index_schema_version: int
    derived_root: str
