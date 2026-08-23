"""Learning candidate deduplicator (M10): exact (问题,答案) dedup."""
from __future__ import annotations

from typing import List


def dedup_qa(qa: List[dict]) -> List[dict]:
    seen = set()
    out = []
    for item in qa:
        key = (str(item.get("问题", "")), str(item.get("答案", "")))
        if key not in seen and key != ("", ""):
            seen.add(key)
            out.append(item)
    return out
