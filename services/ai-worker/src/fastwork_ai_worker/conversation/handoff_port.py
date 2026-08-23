"""HandoffDecisionPort boundary (TASK-020 M5). Full rule engine deferred to M9."""
from __future__ import annotations

from typing import Any, Dict, Optional


class HandoffDecisionPort:
    """M5 boundary: returns a TransferDecision-shaped dict or None. No rule evaluation."""

    def decide(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return None


class NoopHandoffDecisionPort(HandoffDecisionPort):
    pass


class FakeHandoffDecisionPort(HandoffDecisionPort):
    """Returns the fixture decision only at the post-generation HANDOFF stage (GF-CONV-008)."""

    def __init__(self, decision: Optional[Dict[str, Any]] = None):
        self._decision = decision

    def decide(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if context.get("stage") != "post":
            return None
        return self._decision
