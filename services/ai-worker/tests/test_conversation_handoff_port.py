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

class TestHandoffPort(unittest.TestCase):
    def test_post_handoff_transfer(self):
        e = make_engine(handoff_port=FakeHandoffDecisionPort(decision={"requested": True, "target": "售后"}))
        r = e.generate({"question": "我要退款", "order_state": "已下单"})
        decs = [t for t in r["trace"] if t["operation"] == "HANDOFF"]
        self.assertTrue(any(d.get("decision") == "transfer" for d in decs))
        self.assertEqual(r["decision"].get("target"), "售后")

    def test_no_handoff_by_default(self):
        e = make_engine()
        r = e.generate({"question": "你好"})
        decs = [t for t in r["trace"] if t["operation"] == "HANDOFF"]
        self.assertTrue(any(d.get("decision") == "no" for d in decs))


if __name__ == "__main__":
    unittest.main()
