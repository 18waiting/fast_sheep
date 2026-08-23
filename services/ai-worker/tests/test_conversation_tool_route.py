import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from fastwork_ai_worker.conversation.conversation_engine import ConversationEngine
from fastwork_ai_worker.conversation.test_doubles import (
    FakeClock, FakeRAGEngine, FakeGenerationProvider, FakePromptEngine, FakeRouter, FakeAgentLoop,
    FakeHandoffDecisionPort, MockQuestionCompletionPort,
)
from fastwork_ai_worker.conversation.duplicate_cache import DuplicateCache
from fastwork_ai_worker.conversation.welcome_policy import WelcomePolicy
from fastwork_ai_worker.conversation.order_context import OrderContextProvider
from fastwork_ai_worker.conversation.post_processor import PostProcessor


def make_engine(**kw):
    defaults = dict(
        rag_engine=FakeRAGEngine(top_sim=0.5), prompt_engine=FakePromptEngine(), provider_router=FakeRouter(),
        generation_provider=FakeGenerationProvider(scenarios=[{"text": "ok"}]), agent_loop=FakeAgentLoop(),
        duplicate_cache=DuplicateCache(clock=FakeClock()), order_context=OrderContextProvider(),
        welcome=WelcomePolicy(enabled=False), question_completion=MockQuestionCompletionPort(),
        handoff_port=FakeHandoffDecisionPort(), post_processor=PostProcessor(), clock=FakeClock(),
    )
    defaults.update(kw)
    return ConversationEngine(**defaults)

class TestToolRoute(unittest.TestCase):
    def test_tool_route_uses_agent_loop(self):
        provider = FakeGenerationProvider(scenarios=[{"tool_calls": [{"name": "stock_query", "arguments": {"sku": "A1"}}], "text": ""}])
        e = make_engine(generation_provider=provider)
        r = e.generate({"question": "帮我查一下手机库存"})
        ops = [t["operation"] for t in r["trace"]]
        self.assertIn("TOOL_CALL", ops)
        self.assertIn("EXECUTE", ops)
        self.assertIn("CONTINUE", ops)
        decs = [t.get("decision") for t in r["trace"] if t["operation"] == "AGENT_LOOP"]
        self.assertIn("tool-call", decs)


if __name__ == "__main__":
    unittest.main()
