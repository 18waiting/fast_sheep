"""Review selector (M10): source whitelist filter + B-library dedup + cold-start protection."""
from __future__ import annotations

from typing import Any, Dict, List


def filter_whitelist(candidates: List[Dict[str, Any]], whitelist: List[str]) -> List[Dict[str, Any]]:
    if not whitelist:
        return candidates
    return [c for c in candidates if str(c.get("来源") or c.get("source") or "") in whitelist]


def dedup_against_b(candidates: List[Dict[str, Any]], b_library: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    b_keys = {(str(x.get("问题") or x.get("question") or ""), str(x.get("答案") or x.get("answer") or "")) for x in b_library}
    return [c for c in candidates if (str(c.get("问题") or c.get("question") or ""), str(c.get("答案") or c.get("answer") or "")) not in b_keys]


def cold_start_protected(candidates: List[Dict[str, Any]], b_library: List[Dict[str, Any]], sop: Any) -> bool:
    return len(candidates) > 0 and len(b_library) == 0 and sop is None
