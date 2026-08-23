"""Handoff port adapter (M9). Production HandoffDecisionPort backed by HandoffPolicyEngine."""
from __future__ import annotations

from typing import Any, Dict, Optional

from ..conversation.handoff_port import HandoffDecisionPort
from .handoff_engine import HandoffPolicyEngine
from .clock import SystemClock


class HandoffPortAdapter(HandoffDecisionPort):
    """Maps ConversationEngine stages to the policy engine and returns
    TransferDecision-shaped dicts (`requested`). Rule loading is read-only."""

    def __init__(self, engine: Optional[HandoffPolicyEngine] = None, rule_loader=None, clock=None):
        self._engine = engine or HandoffPolicyEngine()
        self._rule_loader = rule_loader  # callable() -> List[HandoffRule]
        self._clock = clock or SystemClock()

    def decide(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if context.get("stage") == "early":
            return self._early(context)
        return self._post(context)

    def _early(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        # Qianniu early handoff is config-driven (千牛转接配置). M9 exposes the
        # boundary; exact trigger rule evaluation belongs to M9 source (PARTIAL).
        config = context.get("qianniu_config") or {}
        if not config.get("enabled"):
            return None
        trigger = config.get("trigger_words") or []
        question = str(context.get("question") or "")
        if any(t in question for t in trigger):
            return {"requested": True, "target": config.get("target") or "人工", "reason": "qianniu_early"}
        return None

    def _post(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rules = self._rule_loader() if self._rule_loader else (context.get("rules") or [])
        decision = self._engine.decide({
            "rules": [r.__dict__ if hasattr(r, "__dict__") else r for r in rules],
            "question": context.get("question") or "",
            "ai_reply": context.get("reply") or "",
            "agent": context.get("agent") or "",
            "shop": context.get("shop") or "",
            "order_state": context.get("order_state") or "",
            "highest_sim": float(context.get("top_sim") or context.get("highest_sim") or 0.0),
            "time_ms": self._clock.now_ms(),
            "platform": context.get("platform") or "",
            "capabilities": context.get("capabilities") or {},
            "enabled": context.get("enabled", True),
        })
        if decision.get("transfer"):
            return {"requested": True, "target": decision.get("target"), "reason": decision.get("reason"), "keyword": decision.get("keyword"), "transfer_message": decision.get("transfer_message")}
        return {"requested": False}
