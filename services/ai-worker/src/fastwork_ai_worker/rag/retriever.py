"""Retriever (TASK-018 M3): tiered retrieval common -> product -> global fill.

Collects candidates in observed priority order and records tier decisions for
the frozen GF-RAG-TIER / GF-RAG-QTH decision oracles. No rerank scoring here.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np

from .index_repository import IndexRepository
from .types import RawHit, TieredRetrieval

COMMON_PRODUCT_ID = "1"


class Retriever:
    def __init__(self, repo: IndexRepository, config: Optional[Dict[str, Any]] = None):
        self.repo = repo
        self.config = config or {}

    def _quality_threshold(self) -> float:
        return float(self.config.get("product_quality_threshold", 0.6))

    def _min_search_score(self) -> float:
        return float(self.config.get("min_search_score", 0.02))

    def _search_tier(self, kind: str, query_vector: np.ndarray, top_k: int, product_id: Optional[str] = None) -> List[RawHit]:
        hits: List[RawHit] = []
        threshold = self._quality_threshold() if kind in ("common", "product") else self._min_search_score()
        pairs = self.repo.search(kind, query_vector, top_k, product_id=product_id)
        for faiss_id, score in pairs:
            if score < threshold:
                continue
            m = self.repo.resolve_entry(kind, faiss_id, product_id=product_id)
            if m is None:
                continue
            hits.append(
                RawHit(
                    entry_id=str(m.get("entry_id", "")),
                    question=str(m.get("question", "")),
                    answer=str(m.get("answer", "")),
                    product_id=str(m.get("product_id", "")),
                    source=str(m.get("source", "")),
                    tags=list(m.get("tags") or []),
                    faiss_id=int(faiss_id),
                    raw_similarity=float(score),
                    tier=kind,
                )
            )
        return hits

    def retrieve(
        self,
        query_vector: np.ndarray,
        product_id: Optional[str],
        top_k: int,
        knowledge_isolation: Optional[bool] = None,
    ) -> TieredRetrieval:
        isolation = knowledge_isolation if knowledge_isolation is not None else bool(self.config.get("product_isolation", False))
        common = self._search_tier("common", query_vector, top_k)
        product: List[RawHit] = []
        if product_id and product_id != COMMON_PRODUCT_ID:
            product = self._search_tier("product", query_vector, top_k, product_id=product_id)
        global_hits: List[RawHit] = []
        if not isolation:
            multiplier = int(self.config.get("global_search_multiplier", 2))
            global_hits = self._search_tier("global", query_vector, top_k * multiplier)
        # Merge in priority order, dedupe by entry_id.
        merged: List[RawHit] = []
        seen: set = set()
        for hit in common + product + global_hits:
            if hit.entry_id in seen:
                continue
            seen.add(hit.entry_id)
            merged.append(hit)
        tier_used = merged[0].tier if merged else "none"
        tr = TieredRetrieval(
            common_hits=common,
            product_hits=product,
            global_hits=global_hits,
            decisions=self.tier_decisions(common, product, global_hits, isolation),
            tier_used=tier_used,
        )
        return tr

    @staticmethod
    def tier_decisions(common, product, global_hits, isolation: bool) -> List[Dict[str, Any]]:
        """Decision record matching the GF-RAG-TIER-* oracle shapes (primary-tier model)."""
        if common:
            return [
                {"tier": "common", "used": True},
                {"tier": "product", "used": False},
                {"tier": "global", "used": False},
            ]
        if product:
            return [
                {"tier": "common", "used": False},
                {"tier": "product", "used": True},
                {"tier": "global", "used": True},
            ]
        if global_hits:
            return [{"tier": "global", "used": True, "fill": True}]
        if isolation:
            return [{"tier": "global", "used": False, "reason": "product_isolation"}]
        return [{"tier": "global", "used": False}]

    def quality_decision(self, top_product_sim: Optional[float]) -> List[Dict[str, Any]]:
        """Decision record matching the GF-RAG-QTH-* oracle shapes (>= threshold)."""
        threshold = self._quality_threshold()
        if top_product_sim is None or top_product_sim < threshold:
            return [{"product_used": False, "reason": "below_quality_threshold"}]
        if float(top_product_sim) == float(threshold):
            return [{"product_used": True, "operator": "gte"}]
        return [{"product_used": True}]
