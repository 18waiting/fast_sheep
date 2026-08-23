import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""M5: product + completed fast return (GF-CONV-004/005)."""
from fastwork_ai_worker.conversation.conversation_engine import ConversationEngine
from fastwork_ai_worker.conversation.test_doubles import (
    FakeClock, FakeRAGEngine, FakeGenerationProvider, FakePromptEngine, FakeRouter, FakeAgentLoop,
    FakeHandoffDecisionPort, MockQuestionCompletionPort,
)
from fastwork_ai_worker.conversation.duplicate_cache import DuplicateCache
from fastwork_ai_worker.conversation.welcome_policy import WelcomePolicy
from fastwork_ai_worker.conversation.order_context import OrderContextProvider
from fastwork_ai_worker.conversation.post_processor import PostProcessor


def engine_for(**kw):
    defaults = dict(
        generation_provider=FakeGenerationProvider(scenarios=[{"text": "x"}]),
        prompt_engine=FakePromptEngine(), provider_router=FakeRouter(), agent_loop=FakeAgentLoop(),
        duplicate_cache=DuplicateCache(clock=FakeClock()), order_context=OrderContextProvider(),
        welcome=WelcomePolicy(enabled=False), question_completion=MockQuestionCompletionPort(),
        handoff_port=FakeHandoffDecisionPort(), post_processor=PostProcessor(), clock=FakeClock(),
    )
    defaults.update(kw)
    return ConversationEngine(**defaults)


class TestFastReturn(unittest.TestCase):
    def test_product_fast_return_no_generation(self):
        provider = FakeGenerationProvider(scenarios=[{"text": "should-not-run"}])
        e = engine_for(rag_engine=FakeRAGEngine(top_sim=0.95), generation_provider=provider)
        r = e.generate({"question": "有没有XL码"})
        self.assertTrue(r["fast_return"])
        self.assertEqual(provider.call_count, 0)

    def test_completed_fast_return(self):
        e = engine_for(rag_engine=FakeRAGEngine(top_sim=0.5), question_completion=MockQuestionCompletionPort(completed_question="这件衣服多少钱"))
        r = e.generate({"question": "这个衣服多少钱", "completed_sim": 0.95})
        self.assertTrue(r["fast_return"])


if __name__ == "__main__":
    unittest.main()
