"""Review apply (M10): triple-match delete + durable deletion record append."""
from __future__ import annotations

from typing import Any, Dict, List


def triple_match(row: Dict[str, Any], entry: Dict[str, Any]) -> bool:
    return (
        str(row.get("product_id") or "") == str(entry.get("商品ID") or entry.get("product_id") or "")
        and str(row.get("question") or "") == str(entry.get("问题") or entry.get("question") or "")
        and str(row.get("answer") or "") == str(entry.get("答案") or entry.get("answer") or "")
    )


def apply_delete(delete_list: List[Dict[str, Any]], kb_rows: List[Dict[str, Any]], protected: bool = False) -> Dict[str, Any]:
    if protected:
        return {"deleted": 0, "protected": True, "rows": []}
    deleted = 0
    rows: List[Dict[str, Any]] = []
    remaining = list(kb_rows)
    for item in delete_list:
        matched = [r for r in remaining if triple_match(r, item)]
        for r in matched:
            rows.append(r)
            remaining.remove(r)
            deleted += 1
    return {"deleted": deleted, "rows": rows}
