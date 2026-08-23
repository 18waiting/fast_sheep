"""Handoff RPC methods (M9). handoff.evaluate is the production evaluation boundary."""
from __future__ import annotations

import sys
from typing import Any, Dict, Optional

from ...handoff.handoff_engine import HandoffPolicyEngine, evaluate_handoff
from ...handoff.errors import HandoffError
from .. import protocol as rpc_protocol


class HandoffMethods:
    def __init__(self, server: Any):
        self._server = server

    def register(self, dispatcher: Any) -> None:
        dispatcher.register("handoff.evaluate", self.evaluate)

    async def evaluate(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        ok, errs = rpc_protocol.validate_rpc_envelope("fastwork:handoff:handoff-evaluation-request", payload)
        if not ok:
            raise HandoffError("handoff.invalid_request", "; ".join(errs))
        engine = HandoffPolicyEngine()
        if not payload.get("rules"):
            # Production path: rules come from canonical transfer_rules (read-only).
            import os
            from ...persistence import open_worker_db
            from ...handoff.rule_repository import RuleRepository
            try:
                conn = open_worker_db(os.environ.get("FASTWORK_DATA_DIR", ""))
                rules = [r.__dict__ for r in RuleRepository(conn).load_all()]
                payload = {**payload, "rules": rules}
            except Exception:
                pass
        decision = evaluate_handoff(payload, engine)
        return {"decision": decision}
