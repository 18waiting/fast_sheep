"""DI composition (TASK-020 M5): build a ConversationEngine with real M3/M4 components
plus deterministic mocks for the worker/test harness. No live network.
"""
from __future__ import annotations

import os
import tempfile
from typing import Any, Dict, Optional

from ..rag.rag_engine import RAGEngine
from ..rag.index_repository import IndexRepository
from ..rag.mock_embedding_provider import MockEmbeddingProvider
from ..prompt.prompt_engine import PromptEngine
from ..providers.provider_router import ProviderRouter
from ..providers.mock_generation_provider import MockGenerationProvider
from ..tools.tool_registry import ToolRegistry
from ..tools.tool_executor import ToolExecutor
from ..tools.agent_loop import AgentLoop
from ..tools.builtin_transfer_tool import register as register_transfer
from .clock import FakeClock
from .conversation_engine import ConversationEngine
from .duplicate_cache import DuplicateCache
from .handoff_port import NoopHandoffDecisionPort
from ..handoff.handoff_port_adapter import HandoffPortAdapter
from ..handoff.handoff_engine import HandoffPolicyEngine
from .order_context import OrderContextProvider
from .post_processor import PostProcessor
from .question_completion import MockQuestionCompletionPort
from .welcome_policy import WelcomePolicy


def _mock_rag_engine(config: Optional[Dict[str, Any]] = None):
    """A deterministic RAG engine over an in-memory derived index (offline).

    M7 vertical smoke: when FASTWORK_M5_RAG_ROOT is pre-provisioned (derived
    index built offline), reuse it so the real ConversationEngine retrieves
    deterministically; otherwise fall back to a fresh empty mock root.
    """
    root = os.environ.get("FASTWORK_M5_RAG_ROOT") or tempfile.mkdtemp(prefix="fw-m5-rag-")
    os.environ.setdefault("FASTWORK_M5_RAG_ROOT", root)
    repo = IndexRepository(root, config=config or {}, dimension=1024)
    provider = MockEmbeddingProvider(dimension=1024)
    return RAGEngine(repo, provider, rerank_provider=None, rag_config_payload=config)


def build_default_engine(
    config: Optional[Dict[str, Any]] = None,
    clock: Optional[FakeClock] = None,
    question_completion=None,
    handoff_port=None,
    generation_provider=None,
) -> ConversationEngine:
    config = config or {}
    rag_cfg = config.get("rag") or {}
    clock = clock or FakeClock()
    rag_engine = _mock_rag_engine(rag_cfg)
    prompt_engine = PromptEngine()
    router = ProviderRouter()
    provider = generation_provider or MockGenerationProvider(scenarios=[{"text": "亲,有XL码的哦~"}])
    registry = ToolRegistry()
    register_transfer(registry)
    executor = ToolExecutor(registry=registry)
    agent_loop = AgentLoop(provider, registry, executor, max_rounds=5, dead_loop_threshold=2)
    welcome = WelcomePolicy(enabled=bool(config.get("welcome_enabled", False)), text=str(config.get("welcome_text", "亲,欢迎光临~")))
    return ConversationEngine(
        rag_engine=rag_engine,
        prompt_engine=prompt_engine,
        provider_router=router,
        generation_provider=provider,
        agent_loop=agent_loop,
        duplicate_cache=DuplicateCache(clock=clock, ttl_ms=int(config.get("dup_cache_ttl_ms", 60000))),
        order_context=OrderContextProvider(),
        welcome=welcome,
        question_completion=question_completion or MockQuestionCompletionPort(),
        handoff_port=handoff_port or _default_handoff_port(config),
        post_processor=PostProcessor(),
        clock=clock,
    )


def _default_handoff_port(config):
    """Production: real HandoffPolicyEngine via HandoffPortAdapter; test mode may
    inject fakes for isolated M5 regression (handoff.engine=noop)."""
    if config.get("handoff", {}).get("engine") == "noop":
        return NoopHandoffDecisionPort()
    try:
        import os
        from ..persistence import open_worker_db, KnowledgeRepository  # noqa: F401
        from ..handoff.rule_repository import RuleRepository
        conn = open_worker_db(os.environ.get("FASTWORK_DATA_DIR", ""))
        repo = RuleRepository(conn)
        return HandoffPortAdapter(HandoffPolicyEngine(), rule_loader=repo.load_all)
    except Exception:
        return NoopHandoffDecisionPort()
