"""Deduplicator (TASK-018 M3): exact observed dedupe policy.

Key = question.strip() | answer.strip(); exact duplicates drop; the same
question is kept at most max_repeat (3) times (first copies win), matching
GF-RAG-DEDUP-001..003.
"""
from __future__ import annotations

from typing import Any, Dict, List


def dedupe(results: List[Dict[str, Any]], max_repeat: int = 3) -> List[Dict[str, Any]]:
    seen_keys = set()
    q_count: Dict[str, int] = {}
    out: List[Dict[str, Any]] = []
    for r in results:
        q = str(r.get("q", r.get("question", ""))).strip()
        a = str(r.get("ans", r.get("answer", ""))).strip()
        key = q + "|" + a
        if key in seen_keys:
            continue
        if q_count.get(q, 0) >= max_repeat:
            continue
        seen_keys.add(key)
        q_count[q] = q_count.get(q, 0) + 1
        out.append(r)
    return out


def dedupe_hits(hits: List[Any]) -> List[Any]:
    """Dedupe RawHit objects by question|answer with the same policy."""
    seen_keys = set()
    q_count: Dict[str, int] = {}
    out: List[Any] = []
    for h in hits:
        q = h.question.strip()
        a = h.answer.strip()
        key = q + "|" + a
        if key in seen_keys:
            continue
        if q_count.get(q, 0) >= 3:
            continue
        seen_keys.add(key)
        q_count[q] = q_count.get(q, 0) + 1
        out.append(h)
    return out
