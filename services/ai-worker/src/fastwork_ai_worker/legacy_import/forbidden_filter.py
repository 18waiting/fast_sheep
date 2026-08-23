"""Forbidden-word filter (M11, clean-room compatibility). Implements the canonical
replace behavior for GF-STORE-FORBID-001 (微信 -> ""): longest-match first so
overlapping terms never double-replace. This is data filtering only — the M11
importer never runs the send pipeline.
"""
from __future__ import annotations

from typing import Any, Dict, List


def filter_forbidden(text: str, words: List[Dict[str, str]]) -> Dict[str, Any]:
    # Sort by term length descending so longer terms win overlaps.
    ordered = sorted([(str(w.get("违禁词") or w.get("term") or ""), str(w.get("替换为") or w.get("replacement") or "")) for w in words if w.get("违禁词") or w.get("term")], key=lambda x: len(x[0]), reverse=True)
    filtered = text or ""
    replaced = 0
    for term, replacement in ordered:
        if not term:
            continue
        if term in filtered:
            filtered = filtered.replace(term, replacement)
            replaced += 1
    return {"filtered": filtered, "replaced": replaced}
