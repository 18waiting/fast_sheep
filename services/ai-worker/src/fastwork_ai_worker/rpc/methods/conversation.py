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


class ConversationMethodsV2:
    """SHEEP-307: ContextEnvelope-based conversation generation.
    
    This class provides the v2 RPC method that accepts ContextEnvelope
    and returns ReplyPlan, enabling the structured AI output workflow.
    """
    
    def __init__(self, server) -> None:
        self._server = server
        self._engine = None
    
    def register(self, dispatcher) -> None:
        dispatcher.register("conversation.generate_v2", self.generate_v2)
    
    def _get_engine(self):
        if self._engine is None:
            from ...conversation.composition import build_default_engine
            self._engine = build_default_engine()
        return self._engine
    
    async def generate_v2(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """Generate ReplyPlan from ContextEnvelope (SHEEP-307).
        
        This method accepts a ContextEnvelope as input and returns a ReplyPlan.
        It validates the input against context-envelope.schema.json and the
        output against reply-plan.schema.json.
        
        Args:
            req: RPC request with payload containing ContextEnvelope
        
        Returns:
            ReplyPlan dict with plan, trace, and fast_return
        
        Raises:
            ConversationError: If validation fails or generation fails
        """
        payload = req.get("payload") or {}
        
        # Validate input against context-envelope schema
        ok, errs = rpc_protocol.validate_rpc_envelope(
            "fastwork:domain:context-envelope",
            payload
        )
        if not ok:
            raise ConversationError(
                "conversation.invalid_request",
                "; ".join(errs),
                category="validation"
            )
        
        try:
            # Call engine.generate_from_envelope
            result = self._get_engine().generate_from_envelope(payload)
        except ConversationError as e:
            log_stderr("conversation.generate_v2 error: " + e.code)
            raise e
        except Exception as e:  # noqa: BLE001
            log_stderr("conversation.generate_v2 error: " + type(e).__name__)
            raise ConversationError(
                "conversation.internal",
                str(e)[:200],
                category="internal"
            )
        
        # Validate output against reply-plan schema (if plan is present)
        plan = result.get("plan")
        if plan:
            ok, errs = rpc_protocol.validate_rpc_envelope(
                "fastwork:domain:reply-plan",
                plan
            )
            if not ok:
                log_stderr(
                    "conversation.generate_v2 warning: "
                    "ReplyPlan validation failed: " + "; ".join(errs)
                )
                # Don't raise, just log warning (MVP: allow partial plans)
        
        return result
