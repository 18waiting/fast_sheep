"""Learning candidate frequency analyzer (M10).

Groups similar buyer questions by embedding cosine similarity >= threshold (gte),
mirroring the source `高频问答分析器` semantics (threshold default 0.9, top_n 100).
Only the injected deterministic embedding provider is used in tests; no live model.

Summary semantics (GF-LEARN-004/005):
- When at least one group has 2+ members, `groups` reports the number of
  high-frequency groups (>= 2 members) and `members` the largest group size.
- When every group is a singleton, `groups` reports the total number of groups
  so the analyzer never reports an empty high-frequency set.
"""
from __future__ import annotations

from typing import Any, Dict, List


def frequency_groups(questions: List[str], embedding_provider: Any, threshold: float) -> Dict[str, Any]:
    if not questions:
        return {"groups": 0, "members": 0, "threshold_operator": "gte"}
    vectors = embedding_provider.embed(list(questions))
    groups: List[List[int]] = []
    for i, v in enumerate(vectors):
        placed = False
        for g in groups:
            ref = vectors[g[0]]
            denom = float(_norm(v) * _norm(ref)) + 1e-9
            sim = float(sum(a * b for a, b in zip(v, ref)) / denom)
            if sim + 1e-9 >= threshold:
                g.append(i)
                placed = True
                break
        if not placed:
            groups.append([i])
    large = [g for g in groups if len(g) >= 2]
    if large:
        return {"groups": len(large), "members": max(len(g) for g in large), "threshold_operator": "gte"}
    return {"groups": len(groups), "members": 1, "threshold_operator": "gte"}


def _norm(v: Any) -> float:
    try:
        import numpy as np
        return float(np.linalg.norm(v))
    except Exception:  # pragma: no cover - fallback for plain sequences
        return float(sum(x * x for x in v) ** 0.5)
