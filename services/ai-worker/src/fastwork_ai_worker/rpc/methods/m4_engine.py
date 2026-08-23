"""M4 engine.prepare RPC method (TASK-019).

Deterministic M4-only preparation: prompt assembly + provider routing decision +
available tool definitions. NO tool execution, NO handoff policy, NO send decision,
NO ConversationEngine state machine.
"""
from __future__ import annotations

from typing import Any, Dict

from .. import protocol as rpc_protocol
from ...prompt.prompt_engine import PromptEngine
from ...providers.provider_router import ProviderRouter
from ...tools.tool_registry import ToolRegistry


def _validate(schema_id: str, payload: Any) -> None:
    ok, errs = rpc_protocol.validate_rpc_envelope(schema_id, payload)
    if not ok:
        from ...providers.errors import ProviderError, CODE_INVALID_REQUEST

        raise ProviderError(CODE_INVALID_REQUEST, "; ".join(errs))


class M4EngineMethods:
    def __init__(self, server) -> None:
        self._server = server

    def register(self, dispatcher) -> None:
        dispatcher.register("engine.prepare", self.prepare)

    async def prepare(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        _validate("fastwork:engine:prepare-request", payload)
        prompt_engine = PromptEngine()
        prompt_result = prompt_engine.prepare(
            {
                "profile_id": payload.get("profile_id") or "default",
                "order_state": payload.get("order_state") or "未下单",
                "product_id": payload.get("product_id"),
                "product_info": payload.get("product_info") or "",
                "history": payload.get("history") or "",
                "reference_content": payload.get("reference_content") or "",
                "query": payload.get("query", ""),
            }
        )
        router = ProviderRouter()
        route = router.route(
            {
                "mode": payload.get("mode") or "快答专家",
                "daily_count": payload.get("daily_count") or 0,
                "points": payload.get("points") or 0,
                "custom": payload.get("custom"),
            }
        )
        registry = ToolRegistry()
        tool_definitions = []
        for name in registry.names():
            td = registry.get(name)
            tool_definitions.append(td.to_dict() if hasattr(td, "to_dict") else (td if isinstance(td, dict) else {"name": name}))
        return {
            "prompt": prompt_result,
            "route": route,
            "tool_definitions": tool_definitions,
        }
