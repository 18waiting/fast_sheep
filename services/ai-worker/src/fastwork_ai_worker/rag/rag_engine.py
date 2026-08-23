"""RAGEngine (TASK-018 M3): orchestrate ONLY RAG.

embed query -> tiered retrieve -> dedupe -> rerank -> order filter ->
fast-return decision -> RetrievalResult. No PromptEngine, no LLM.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np

from . import fast_return as fast_return_mod
from .config import load_rag_config
from .deduplicator import dedupe_hits
from .errors import CODE_INDEX_NOT_READY, invalid_request
from .index_repository import IndexRepository
from .order_filter import filter_results
from .reference_builder import build_retrieval_result
from .reranker import Reranker
from .retriever import Retriever
from .types import RerankCandidate
from .vector_math import l2_normalize, validate_dimension


class RAGEngine:
    def __init__(
        self,
        repo: IndexRepository,
        embedding_provider,
        rerank_provider=None,
        config: Optional[Dict[str, Any]] = None,
        rag_config_payload: Optional[Dict[str, Any]] = None,
    ):
        self.repo = repo
        self.embedding_provider = embedding_provider
        self.config = load_rag_config(rag_config_payload or config)
        self.retriever = Retriever(repo, self.config)
        self.reranker = Reranker(rerank_provider, self.config)
        self.dimension = int(self.config.get("embedding_dim", 1024))

    def embed_query(self, query: str) -> np.ndarray:
        vectors = self.embedding_provider.embed([query])
        v = np.asarray(vectors[0], dtype=np.float32)
        validate_dimension(v, self.dimension)
        return l2_normalize(v)

    def retrieve(self, request: Dict[str, Any]) -> Dict[str, Any]:
        if not request or not request.get("query"):
            raise invalid_request("query is required")
        query = str(request["query"])
        product_id = request.get("product_id") or None
        if product_id == "":
            product_id = None
        order_state = request.get("order_state")
        isolation = request.get("knowledge_isolation")
        top_k = int(request.get("top_k") or self.config.get("product_search_top_k", 15))

        if not self.repo.ready():
            from .errors import RagError

            raise RagError(CODE_INDEX_NOT_READY, "derived index not ready", category="internal", retryable=True)

        query_vector = self.embed_query(query)
        tr = self.retriever.retrieve(query_vector, product_id, top_k, knowledge_isolation=isolation)

        # dedupe
        hits = dedupe_hits(tr.common_hits + tr.product_hits + tr.global_hits)

        # fast return decision (product-level) before rerank (observed short-circuit)
        top_sim = max((h.raw_similarity for h in hits), default=0.0)
        fr = fast_return_mod.product_fast_return(top_sim, self.config)
        fast_return = bool(fr["fast_return"])

        if fast_return:
            # short-circuit: skip global fill/rerank; use product best answer only
            best = sorted(hits, key=lambda h: h.raw_similarity, reverse=True)[:1]
            stats = {"candidates": len(hits), "fast_return": True, "embedding_ms": 0, "search_ms": 0, "rerank_ms": 0}
            result = build_retrieval_result(query, best, True, tr.tier_used, stats)
            result["hits"] = result["hits"]
            return result

        # rerank (skip decision inside)
        candidates = [RerankCandidate(hit=h) for h in hits]
        reranked = self.reranker.rerank(query, candidates, top_n=int(self.config.get("reference_top_n", 10)))
        final_hits = [c.hit for c in reranked]

        # order filter
        if order_state:
            order_result = filter_results(
                [{"q": h.question, "ans": h.answer, "tags": h.tags} for h in final_hits], order_state
            )
            kept_q = {(r["q"], r["ans"]) for r in order_result["kept"]}
            final_hits = [h for h in final_hits if (h.question, h.answer) in kept_q]

        stats = {
            "candidates": len(hits),
            "tier_used": tr.tier_used,
            "embedding_ms": 0,
            "search_ms": 0,
            "rerank_ms": 0,
            "rerank_called": len(self.reranker.call_log),
        }
        return build_retrieval_result(query, final_hits, False, tr.tier_used, stats)
