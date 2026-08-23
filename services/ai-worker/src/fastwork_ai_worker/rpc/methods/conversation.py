"""conversation.generate RPC method (TASK-020 M5).

Validates schemas, respects M2 cancellation/timeout, normalizes errors, keeps
stdout protocol-only, zero external network calls.
"""
from __future__ import annotations

from typing import Any, Dict

from .. import protocol as rpc_protocol
from ..framing import log_stderr
from ...conversation.composition import build_default_engine
from ...conversation.errors import ConversationError


def _validate(schema_id: str, payload: Any) -> None:
    ok, errs = rpc_protocol.validate_rpc_envelope(schema_id, payload)
    if not ok:
        raise ConversationError("conversation.invalid_request", "; ".join(errs), category="validation")


class ConversationMethods:
    def __init__(self, server) -> None:
        self._server = server
        self._engine = None

    def register(self, dispatcher) -> None:
        dispatcher.register("conversation.generate", self.generate)

    def _get_engine(self):
        if self._engine is None:
            self._engine = build_default_engine()
        return self._engine

    async def generate(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        _validate("fastwork:conversation:conversation-engine-request", payload)
        try:
            result = self._get_engine().generate(payload)
        except ConversationError as e:
            log_stderr("conversation.generate error: " + e.code)
            raise e
        except Exception as e:  # noqa: BLE001
            log_stderr("conversation.generate error: " + type(e).__name__)
            raise ConversationError("conversation.internal", str(e)[:200], category="internal")
        return result
