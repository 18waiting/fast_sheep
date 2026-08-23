"""Feedback effect mapper (M9, clean-room). Derived from GF-FB-001..007."""
from __future__ import annotations

import hashlib
from typing import Optional
from .types import FeedbackApplyRequest, KnowledgeEffect


def _entry_id(question: str, answer: str, product_id: str) -> str:
    h = hashlib.sha256(f"{question}|{answer}|{product_id}".encode("utf-8")).hexdigest()[:24]
    return "fe-" + h


def map_effect(req: FeedbackApplyRequest) -> KnowledgeEffect:
    """Map a feedback class to its canonical knowledge effect (frozen fixture semantics)."""
    cls = req.class_name
    if cls == "NO_SAVE":
        return KnowledgeEffect(op="none", index_refresh="none")
    if cls == "AUTO":
        return KnowledgeEffect(op="append", trust="AUTO", index_refresh="none")
    if cls == "MANUAL":
        return KnowledgeEffect(op="append", trust="HUMAN_CONFIRMED", index_refresh="none")
    if cls == "CORRECTION":
        return KnowledgeEffect(op="insert", trust="HUMAN_CONFIRMED", index_refresh="incremental")
    if cls == "AUDIT_APPROVE":
        return KnowledgeEffect(op="insert", trust="HUMAN_CONFIRMED", index_refresh="incremental")
    if cls == "RESTORE":
        return KnowledgeEffect(op="append", trust="AUTO", index_refresh="deferred")
    return KnowledgeEffect(op="none", index_refresh="none")


def entry_for(req: FeedbackApplyRequest, effect: KnowledgeEffect) -> Optional[dict]:
    if effect.op == "none":
        return None
    question = req.question or str(req.entry.get("问题") or req.entry.get("question") or "")
    answer = req.answer or str(req.entry.get("答案") or req.entry.get("answer") or "")
    product_id = req.product_id or str(req.entry.get("商品ID") or req.entry.get("product_id") or "")
    if not question or not answer:
        return None
    entry_id = _entry_id(question, answer, product_id)
    return {
        "id": entry_id,
        "question": question,
        "answer": answer,
        "product_id": product_id or "1",   # GF-FB-005: empty product -> '1' (通用)
        "tags": [],
        "source": "feedback",
        "trust_level": effect.trust,
        "created_at": req.created_at or "2026-08-16T00:00:00Z",
        "updated_at": req.created_at or "2026-08-16T00:00:00Z",
    }
