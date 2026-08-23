"""Legacy A/B/pending state mapper (M11, clean-room).

A库 -> AUTO; B库人工确认过 -> HUMAN_CONFIRMED; 待审核 -> PENDING (candidate).
Deterministic import identity from source/content fingerprint keeps repeated
imports idempotent (no random UUID per apply).
"""
from __future__ import annotations

import hashlib
from typing import Dict, List, Tuple

TRUST_BY_LIBRARY: Dict[str, str] = {
    "A库": "AUTO",
    "A库全自动收录": "AUTO",
    "B库": "HUMAN_CONFIRMED",
    "B库人工确认过": "HUMAN_CONFIRMED",
    "待审核": "PENDING",
    "一键生成问答对结果": "GENERATED",
    "通用知识库": "PROTECTED",
}

# Generic imported knowledge rows (no A/B/pending library context) map to GENERATED
# (GF-STORE-001).


def library_for_path(path: str) -> str:
    if "人工确认" in path or "B库" in path:
        return "B库"
    if "待审核" in path:
        return "待审核"
    if "全自动收录" in path or "A库" in path:
        return "A库"
    return "A库"


def trust_for_library(library: str) -> str:
    return TRUST_BY_LIBRARY.get(library, "GENERATED")


def import_entry_id(selection_id: str, item_id: str, library: str, question: str, answer: str, product_id: str) -> str:
    raw = f"{selection_id}|{item_id}|{library}|{question}|{answer}|{product_id}"
    return "li-" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def map_rows_to_entries(selection_id: str, item_id: str, rows: List[Dict[str, str]], library: str) -> List[Dict[str, str]]:
    trust = trust_for_library(library)
    entries = []
    for row in rows:
        q = row.get("问题") or row.get("question") or ""
        a = row.get("答案") or row.get("answer") or ""
        pid = row.get("商品ID") or row.get("product_id") or row.get("商品Id") or ""
        tags = [t for t in (row.get("标签") or row.get("tags") or "").split(",") if t] if not isinstance(row.get("tags"), list) else [str(t) for t in row.get("tags") or []]
        entry_id = import_entry_id(selection_id, item_id, library, q, a, pid)
        entries.append({
            "id": entry_id,
            "question": q,
            "answer": a,
            "product_id": pid or "1",  # 通用知识库 fallback
            "tags": tags,
            "source": "legacy_import",
            "trust_level": trust,
            "created_at": "2026-08-17T00:00:00Z",
            "updated_at": "2026-08-17T00:00:00Z",
            "library": library,
        })
    return entries
