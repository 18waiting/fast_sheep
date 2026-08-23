"""Learning index refresh policy (M10).

Maps learning/review/audit mutations to the RAG index refresh gate:
- append rows            -> incremental
- knowledge base delete  -> full rebuild
- review delete entry    -> precise_delete (fallback full on failure)
"""
from __future__ import annotations

from typing import Any, Dict


def index_signal(mutation: str, rows: int = 0, entry_id: str = "", precise_delete_error: bool = False) -> Dict[str, Any]:
    if mutation == "append" and rows > 0:
        return {"refresh": "incremental", "mode": "incremental"}
    if mutation == "kb_delete":
        return {"refresh": "full", "mode": "full"}
    if mutation == "review_delete":
        if precise_delete_error:
            return {"refresh": "full_fallback", "mode": "full_fallback"}
        return {"refresh": "precise_delete", "mode": "precise_delete", "entry_id": entry_id}
    return {"refresh": "none", "mode": "none"}


def refresh_for(mutation: str, **kwargs: Any) -> Dict[str, Any]:
    return index_signal(mutation, **kwargs)
