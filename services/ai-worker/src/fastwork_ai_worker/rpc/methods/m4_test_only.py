"""M4 test-only RPC methods (TASK-019). Registered ONLY under FASTWORK_RPC_TEST_MODE=1.

test.prompt_assemble / test.provider_route / test.provider_normalize / test.agent_run.
Production mode never exposes these.
"""
from __future__ import annotations

from typing import Any, Dict

from ..framing import log_stderr
from ...prompt.prompt_engine import PromptEngine
from ...providers.provider_router import ProviderRouter
from ...providers.result_normalizer import normalize as normalize_result
from ...providers.mock_generation_provider import MockGenerationProvider
from ...tools.tool_registry import ToolRegistry
from ...tools.tool_definition_builder import from_skill
from ...tools.tool_executor import ToolExecutor
from ...tools.agent_loop import AgentLoop
from ...tools.builtin_transfer_tool import register as register_transfer


def is_test_mode() -> bool:
    import os

    return os.environ.get("FASTWORK_RPC_TEST_MODE") == "1"


class M4TestOnlyMethods:
    def __init__(self, server) -> None:
        self._server = server

    def register(self, dispatcher) -> None:
        if not is_test_mode():
            return
        dispatcher.register("test.prompt_assemble", self.prompt_assemble)
        dispatcher.register("test.provider_route", self.provider_route)
        dispatcher.register("test.provider_normalize", self.provider_normalize)
        dispatcher.register("test.agent_run", self.agent_run)

    async def prompt_assemble(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        engine = PromptEngine()
        return engine.prepare(payload)

    async def provider_route(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        router = ProviderRouter()
        return router.route(payload)

    async def provider_normalize(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        protocol = payload.get("protocol", "chat_completions")
        raw = payload.get("raw", {})
        request_id = payload.get("request_id", "r1")
        return normalize_result(raw, protocol, request_id)

    async def agent_run(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        skills = payload.get("skills", [])
        registry = ToolRegistry()
        for skill in skills:
            registry.register_skill(skill)
        register_transfer(registry)
        executor = ToolExecutor(registry=registry)
        provider = MockGenerationProvider(scenarios=payload.get("scenarios"))
        loop = AgentLoop(provider, registry, executor, max_rounds=int(payload.get("max_rounds") or 5))
        return loop.run({"messages": payload.get("messages", [{"role": "user", "content": payload.get("query", "")}])})
