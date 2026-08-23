"""Test doubles for the ConversationEngine (TASK-020 M5). Canonical test-double path."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .clock import FakeClock
from .handoff_port import FakeHandoffDecisionPort, NoopHandoffDecisionPort
from .question_completion import MockQuestionCompletionPort
from .welcome_policy import WelcomePolicy


class FakeGenerationProvider:
    """Deterministic generation provider for tests: scripted responses or error."""

    def __init__(self, scenarios: Optional[List[Dict[str, Any]]] = None, error: Optional[Dict[str, Any]] = None):
        self.scenarios = scenarios or [{"text": "亲,有XL码的哦~"}]
        self.error = error
        self.call_count = 0

    def generate(self, request: Dict[str, Any]) -> Dict[str, Any]:
        self.call_count += 1
        if self.error is not None:
            return {"error": self.error, "text": "", "tool_calls": []}
        idx = min(self.call_count - 1, len(self.scenarios) - 1)
        return dict(self.scenarios[idx])


class FakeRAGEngine:
    """Deterministic RAG engine for tests."""

    def __init__(self, top_sim: float = 0.5, hits: Optional[List[Dict[str, Any]]] = None, error: Optional[str] = None):
        self.top_sim = top_sim
        self.hits = hits if hits is not None else [{"question": "q", "answer": "a", "raw_similarity": top_sim}]
        self.error = error

    def retrieve(self, request: Dict[str, Any]) -> Dict[str, Any]:
        if self.error:
            from ..rag.errors import RagError

            raise RagError(self.error, self.error, category="retrieval", retryable=True)
        return {"query": request.get("query"), "hits": self.hits, "tier_used": "product"}


class FakePromptEngine:
    def prepare(self, request: Dict[str, Any]) -> Dict[str, Any]:
        return {"prompt": "synthetic prompt", "slots": ["head", "product", "history", "reference"]}


class FakeRouter:
    def __init__(self, error: Optional[Dict[str, Any]] = None):
        self.error = error

    def route(self, request: Dict[str, Any]) -> Dict[str, Any]:
        if self.error:
            return {"error": self.error, "provider": None, "trace": []}
        return {"provider": "mock", "protocol": "chat_completions", "model": "mock", "trace": []}


class FakeAgentLoop:
    def __init__(self, text: str = ""):
        self.text = text

    def run(self, request: Dict[str, Any]) -> Dict[str, Any]:
        return {"rounds": 1, "text": self.text, "terminated": "finish", "tool_results": []}
