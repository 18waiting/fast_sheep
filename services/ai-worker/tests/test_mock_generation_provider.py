"""M4 MockGenerationProvider tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.mock_generation_provider import MockGenerationProvider, fingerprint


REQUEST = {"request_id": "req-1", "messages": [{"role": "user", "content": "你好"}]}


class TestFingerprint(unittest.TestCase):
    def test_deterministic_for_same_messages(self):
        a = {"messages": [{"role": "user", "content": "你好"}]}
        b = {"messages": [{"role": "user", "content": "你好"}]}
        self.assertEqual(fingerprint(a), fingerprint(b))

    def test_different_messages_differ(self):
        a = {"messages": [{"role": "user", "content": "你好"}]}
        b = {"messages": [{"role": "user", "content": "再见"}]}
        self.assertNotEqual(fingerprint(a), fingerprint(b))


class TestPlainText(unittest.TestCase):
    def test_plain_text(self):
        p = MockGenerationProvider(scenarios={"default": {"text": "你好呀"}})
        out = p.generate(REQUEST)
        self.assertEqual(out["text"], "你好呀")
        self.assertEqual(out["finish_reason"], "stop")
        self.assertEqual(out["tool_calls"], [])
        self.assertIsNone(out["error"])


class TestToolCalls(unittest.TestCase):
    def test_single_tool_call(self):
        p = MockGenerationProvider(scenarios={"default": {"tool_calls": [{"name": "查价", "arguments": {"region": "上海"}}], "text": ""}})
        out = p.generate(REQUEST)
        self.assertEqual(out["finish_reason"], "tool_calls")
        self.assertEqual(out["tool_calls"], [{"tool_call_id": "call_1", "name": "查价", "arguments": {"region": "上海"}}])

    def test_multiple_rounds_via_list(self):
        call_log = []
        p = MockGenerationProvider(
            scenarios=[
                {"tool_calls": [{"name": "查价", "arguments": {}}], "text": ""},
                {"text": "库存充足"},
            ],
            call_log=call_log,
        )
        first = p.generate(REQUEST)
        second = p.generate(REQUEST)
        self.assertEqual(first["finish_reason"], "tool_calls")
        self.assertEqual(second["text"], "库存充足")
        self.assertEqual(len([c for c in call_log if c[0] == "generation"]), 2)

    def test_malformed_tool_arguments(self):
        p = MockGenerationProvider(scenarios={"default": {"tool_calls": [{"name": "bad", "arguments": "{not json"}]}})
        out = p.generate(REQUEST)
        self.assertEqual(out["tool_calls"][0]["name"], "bad")
        self.assertEqual(out["tool_calls"][0]["arguments"], {})
        self.assertEqual(out["tool_calls"][0]["error"], "malformed_tool_arguments")


class TestNoContentNoTools(unittest.TestCase):
    def test_no_content_no_tools(self):
        p = MockGenerationProvider(scenarios={"default": {"no_content": True}})
        out = p.generate(REQUEST)
        self.assertEqual(out["text"], "")
        self.assertEqual(out["tool_calls"], [])
        self.assertEqual(out["finish_reason"], "stop")


class TestErrors(unittest.TestCase):
    def test_timeout(self):
        p = MockGenerationProvider(scenarios={"default": {"timeout": "timed out"}})
        out = p.generate(REQUEST)
        self.assertEqual(out["finish_reason"], "error")
        self.assertEqual(out["error"]["category"], "timeout")
        self.assertTrue(out["error"]["retryable"])

    def test_provider_error(self):
        p = MockGenerationProvider(scenarios={"default": {"provider_error": "unavailable"}})
        out = p.generate(REQUEST)
        self.assertEqual(out["finish_reason"], "error")
        self.assertEqual(out["error"]["category"], "provider")

    def test_constructor_error(self):
        p = MockGenerationProvider(error="constructor-error")
        out = p.generate(REQUEST)
        self.assertEqual(out["finish_reason"], "error")
        self.assertEqual(out["error"]["category"], "provider")


class TestFallback(unittest.TestCase):
    def test_fallback_route(self):
        p = MockGenerationProvider(scenarios={"default": {"fallback": "doubao->siliconflow", "text": ""}})
        out = p.generate(REQUEST)
        self.assertEqual(out["fallback"], "doubao->siliconflow")
        self.assertEqual(out["finish_reason"], "stop")
        self.assertIsNone(out["error"])


class TestReasoningAndUsage(unittest.TestCase):
    def test_reasoning_text_is_combined(self):
        p = MockGenerationProvider(scenarios={"default": {"reasoning_text": "思考", "text": "回答"}})
        out = p.generate(REQUEST)
        self.assertEqual(out["text"], "思考\n回答")
        self.assertEqual(out["reasoning_text"], "思考")

    def test_usage_is_passed_through(self):
        p = MockGenerationProvider(scenarios={"default": {"text": "hi", "usage": {"input_chars": 2}}})
        out = p.generate(REQUEST)
        self.assertEqual(out["usage"], {"input_chars": 2})


if __name__ == "__main__":
    unittest.main()