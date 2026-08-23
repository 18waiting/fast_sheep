"""ReferenceBuilder (TASK-018 M3): builds normalized RetrievalResult structures.

No prompt assembly; just the canonical retrieval result contract.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .types import RawHit


def build_retrieval_result(
    query: str,
    hits: List[RawHit],
    fast_return: bool,
    tier_used: str,
    stats: Optional[Dict[str, Any]] = None,
    top_n: int = 10,
) -> Dict[str, Any]:
    limited = hits[:top_n]
    result_hits: List[Dict[str, Any]] = []
    for h in limited:
        result_hits.append(
            {
                "question": h.question,
                "answer": h.answer,
                "product_id": h.product_id,
                "source": h.source,
                "raw_similarity": round(float(h.raw_similarity), 6),
                "rerank_score": round(float(getattr(h, "rerank_score", 0.0) or 0.0), 6),
                "composite": round(float(getattr(h, "composite", h.raw_similarity) or h.raw_similarity), 6),
            }
        )
    return {
        "query": query,
        "hits": result_hits,
        "fast_return": bool(fast_return),
        "tier_used": tier_used,
        "stats": stats or {},
    }
