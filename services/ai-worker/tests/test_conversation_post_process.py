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

class TestPostProcess(unittest.TestCase):
    def test_wrap_segments(self):
        e = make_engine()
        r = e.generate({"question": "介绍下产品", "config": {"long_answer_wrap": True, "max_segments": 3}})
        self.assertEqual(r.get("segments"), 3)
        decs = [t.get("decision") for t in r["trace"] if t["operation"] == "POST_PROCESS"]
        self.assertIn("wrap-3-segments", decs)

    def test_rephrase(self):
        e = make_engine()
        r = e.generate({"question": "这个多少钱", "history_contains_reply": True})
        decs = [t.get("decision") for t in r["trace"] if t["operation"] == "POST_PROCESS"]
        self.assertIn("rephrase", decs)


if __name__ == "__main__":
    unittest.main()
