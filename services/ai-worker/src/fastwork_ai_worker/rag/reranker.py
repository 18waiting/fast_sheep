"""Reranker (TASK-018 M3): skip decision, provider invocation, composite score.

Exact observed scoring (rag-pipeline.md + GF-RAG-COMP-*):
  base = w_raw * raw + w_rerank * rerank
  if raw >= raw_protection_threshold: base += raw_protection_bonus * raw
  if rerank < low_rerank_penalty: base *= 0.8
  clamp to composite_clamp (1.0)
Skip rule (GF-RAG-RSKIP-*): top raw similarity >= 0.85 OR candidate count <= 3.
Fallback on provider failure: return original batch (similarity sort by caller).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .errors import CODE_RERANK_FAILED
from .types import RerankCandidate


class Reranker:
    def __init__(self, provider=None, config: Optional[Dict[str, Any]] = None, call_log: Optional[list] = None):
        self.provider = provider
        self.config = config or {}
        self.call_log = call_log if call_log is not None else []

    def should_rerank(self, top_sim: float, candidate_count: int) -> bool:
        skip_top = top_sim >= float(self.config.get("rerank_high_similarity_skip", 0.85))
        skip_few = candidate_count <= int(self.config.get("rerank_skip_candidate_count", 3))
        return not (skip_top or skip_few)

    def skip_decision(self, top_sim: float, candidate_count: int) -> Dict[str, Any]:
        if top_sim >= float(self.config.get("rerank_high_similarity_skip", 0.85)):
            return {"rerank": False, "reason": "top_sim_high"}
        if candidate_count <= int(self.config.get("rerank_skip_candidate_count", 3)):
            return {"rerank": False, "reason": "few_candidates"}
        return {"rerank": True}

    def composite_score(self, raw: float, rerank: float) -> float:
        w_raw = float(self.config.get("similarity_weight", 0.4))
        w_rerank = float(self.config.get("rerank_weight", 0.6))
        raw_prot = float(self.config.get("raw_protection_threshold", 0.7))
        low_rerank = float(self.config.get("low_rerank_penalty", 0.1))
        clamp = float(self.config.get("composite_clamp", 1.0))
        base = w_raw * float(raw) + w_rerank * float(rerank)
        if raw >= raw_prot:
            base += 0.1 * float(raw)
        if rerank < low_rerank:
            base *= 0.8
        return float(min(base, clamp))

    def rerank(
        self,
        query: str,
        candidates: List[RerankCandidate],
        top_n: int = 15,
    ) -> List[RerankCandidate]:
        """Run the skip decision, then provider + composite, or fall back to sort."""
        if not candidates:
            return []
        top_sim = max((c.hit.raw_similarity for c in candidates), default=0.0)
        if not self.should_rerank(top_sim, len(candidates)):
            # skip: local similarity sort, composite = raw
            for c in candidates:
                c.composite = c.hit.raw_similarity
                c.original_similarity = c.hit.raw_similarity
            candidates.sort(key=lambda c: c.composite, reverse=True)
            return candidates[:top_n]
        # provider path
        docs = [c.hit.question + " " + c.hit.answer for c in candidates]
        docs = [d[: int(self.config.get("rerank_document_max_chars", 500))] for d in docs]
        try:
            scores = self.provider.rerank(query, docs)
        except Exception:
            # fallback: original batch similarity-sorted (observed rerank failure fallback)
            self.call_log.append(("rerank_fallback", len(candidates)))
            for c in candidates:
                c.composite = c.hit.raw_similarity
                c.original_similarity = c.hit.raw_similarity
            candidates.sort(key=lambda c: c.composite, reverse=True)
            return candidates[:top_n]
        self.call_log.append(("rerank_called", len(candidates)))
        for c, s in zip(candidates, scores):
            c.rerank_score = float(s)
            c.original_similarity = c.hit.raw_similarity
            c.composite = self.composite_score(c.hit.raw_similarity, c.rerank_score)
        candidates.sort(key=lambda c: c.composite, reverse=True)
        return candidates[:top_n]
