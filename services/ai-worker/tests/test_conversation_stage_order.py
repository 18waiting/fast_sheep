import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

"""M5: canonical ConversationEngine stage order."""
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
        rag_engine=FakeRAGEngine(top_sim=0.5),
        prompt_engine=FakePromptEngine(),
        provider_router=FakeRouter(),
        generation_provider=FakeGenerationProvider(scenarios=[{"text": "ok"}]),
        agent_loop=FakeAgentLoop(),
        duplicate_cache=DuplicateCache(clock=FakeClock()),
        order_context=OrderContextProvider(),
        welcome=WelcomePolicy(enabled=False),
        question_completion=MockQuestionCompletionPort(),
        handoff_port=FakeHandoffDecisionPort(),
        post_processor=PostProcessor(),
        clock=FakeClock(),
    )
    defaults.update(kw)
    return ConversationEngine(**defaults)


class TestStageOrder(unittest.TestCase):
    def test_canonical_order(self):
        r = make_engine().generate({"question": "你好", "order_state": "未下单"})
        ops = [t["operation"] for t in r["trace"]]
        expected = ["DUP_CHECK", "ORDER_CONTEXT", "WELCOME_CHECK", "PROMPT_SELECT", "PRODUCT_RETRIEVAL",
                    "FAST_RETURN_CHECK", "GLOBAL_RETRIEVAL", "QUESTION_COMPLETION", "COMPLETED_RETRIEVAL",
                    "MERGE_DEDUPE", "RERANK", "ORDER_FILTER", "REFERENCE_BUILD", "PROMPT_ASSEMBLY",
                    "MODEL_ROUTE", "AGENT_LOOP", "HANDOFF", "POST_PROCESS"]
        seen = [o for o in ops if o in expected]
        self.assertEqual(seen, expected)

    def test_trace_entries_have_sequence_component_operation(self):
        r = make_engine().generate({"question": "你好"})
        for e in r["trace"]:
            self.assertIn("sequence", e)
            self.assertIn("component", e)
            self.assertIn("operation", e)


if __name__ == "__main__":
    unittest.main()
