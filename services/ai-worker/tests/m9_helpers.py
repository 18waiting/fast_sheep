"""Shared M9 golden helpers (clean-room, test-only)."""
from __future__ import annotations

import json
import random
from typing import Any, Dict, List

from fastwork_ai_worker.handoff.handoff_engine import HandoffPolicyEngine
from fastwork_ai_worker.handoff.target_selector import RandomProvider
from fastwork_ai_worker.handoff.legacy_marker_codec import decode_legacy_marker


class FirstTargetRng:
    """Deterministic injected RNG: always picks the first target (GF-HANDOFF-018)."""
    def choice(self, items):
        return items[0]


def run_handoff_case(fx: Dict[str, Any]) -> str:
    case_id = fx.get("case_id", "")
    if "MARKER" in case_id:
        return _run_marker_case(fx)
    config = fx.get("config") or {}
    rules = config.get("rules") or []
    inp = fx.get("input") or {}
    clock = fx.get("clock") or {}
    start = clock.get("start") or "2026-08-15T00:00:00Z"
    import datetime
    dt = datetime.datetime.fromisoformat(start.replace("Z", "+00:00"))
    time_ms = int(dt.timestamp() * 1000)
    rng = FirstTargetRng()
    engine = HandoffPolicyEngine(RandomProvider(rng))
    context = {
        "rules": rules,
        "question": inp.get("question") or "",
        "ai_reply": inp.get("ai_reply") or inp.get("reply") or "",
        "agent": inp.get("agent") or inp.get("当前客服") or "",
        "shop": inp.get("shop") or inp.get("当前店铺") or "",
        "order_state": inp.get("order_state") or inp.get("订单状态") or "",
        "highest_sim": float(inp.get("highest_sim") or inp.get("最高相似度") or 0.0),
        "time_ms": time_ms,
        "platform": inp.get("platform") or "",
        "enabled": True,
    }
    decision = engine.decide(context) or {"transfer": False}
    expected = (fx.get("expected") or {}).get("decisions") or []
    if not expected:
        return "FAIL" if decision.get("transfer") else "PASS"
    exp = expected[0]
    for key, value in exp.items():
        if decision.get(key) != value:
            return "FAIL"
    return "PASS"


def _run_marker_case(fx: Dict[str, Any]) -> str:
    from fastwork_ai_worker.handoff.legacy_marker_codec import decode_legacy_marker
    reply = (fx.get("input") or {}).get("reply") or ""
    decision = decode_legacy_marker(reply) or {"requested": False}
    expected = (fx.get("expected") or {}).get("decisions") or []
    if not expected:
        return "PASS"
    exp = expected[0].get("transfer") or {}
    for key, value in exp.items():
        if decision.get(key) != value:
            return "FAIL"
    return "PASS"


def run_feedback_case(fx: Dict[str, Any]) -> str:
    from fastwork_ai_worker.feedback.knowledge_feedback_service import KnowledgeFeedbackService
    from fastwork_ai_worker.feedback.effect_mapper import map_effect
    from fastwork_ai_worker.feedback.types import FeedbackApplyRequest
    from fastwork_ai_worker.feedback.index_refresh_port import RecordingIndexRefreshPort
    from fastwork_ai_worker.persistence.in_memory import InMemoryKnowledgeRepository

    inp = fx.get("input") or {}
    cls = inp.get("class") or "AUTO"
    entry = inp.get("entry") or {}
    repo = InMemoryKnowledgeRepository()
    index = RecordingIndexRefreshPort()
    svc = KnowledgeFeedbackService(repo, index)
    req = FeedbackApplyRequest(
        record_id="fr-" + fx["case_id"],
        conversation_id="c1",
        class_name=cls,
        question=str(entry.get("问题") or entry.get("question") or ("问题" if cls != "NO_SAVE" else "")),
        answer=str(entry.get("答案") or entry.get("answer") or ("答案" if cls != "NO_SAVE" else "")),
        product_id=str(entry.get("商品ID") or entry.get("product_id") or ""),
        entry=entry,
        created_at="2026-08-16T00:00:00Z",
    )
    result = svc.apply(req)
    exp = (fx.get("expected") or {}).get("persistence") or []
    if not exp:
        return "PASS"
    exp_knowledge = next((x for x in exp if x.get("aggregate") == "knowledge"), None)
    if exp_knowledge:
        op = exp_knowledge.get("op")
        if op == "none" and result.knowledge_op != "none":
            return "FAIL"
        if op == "append" and result.knowledge_op != "append":
            return "FAIL"
        if op == "insert" and result.knowledge_op != "insert":
            return "FAIL"
    return "PASS"
