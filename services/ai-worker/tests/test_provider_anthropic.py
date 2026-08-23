"""M4 Anthropic Messages adapter tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.adapters import anthropic_messages
from fastwork_ai_worker.providers.errors import ProviderError


class TestAnthropicBuildRequest(unittest.TestCase):
    def test_build_request_url_headers_and_system(self):
        req = anthropic_messages.build_request(
            {
                "base_url": "https://example.com/api",
                "model": "claude-test",
                "credential_ref": "anth-ref",
                "temperature": 0.3,
                "max_output": 800,
            },
            [
                {"role": "system", "content": "sys"},
                {"role": "user", "content": "hi"},
            ],
        )
        self.assertEqual(req["url"], "https://example.com/api/v1/messages")
        self.assertEqual(req["headers"]["x-api-key"], "anth-ref")
        self.assertEqual(req["headers"]["anthropic-version"], "2023-06-01")
        self.assertEqual(req["payload"]["model"], "claude-test")
        self.assertEqual(req["payload"]["max_tokens"], 800)
        self.assertEqual(req["payload"]["system"], "sys")
        self.assertEqual(req["payload"]["messages"], [{"role": "user", "content": [{"type": "text", "text": "hi"}]}])

    def test_tool_use_and_tool_result_conversion(self):
        req = anthropic_messages.build_request(
            {"base_url": "https://example.com", "model": "m"},
            [
                {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [{"id": "t1", "name": "lookup", "arguments": {"q": "x"}}],
                },
                {"role": "tool", "tool_call_id": "t1", "content": "result"},
            ],
        )
        blocks = req["payload"]["messages"][0]["content"]
        self.assertEqual(blocks[0], {"type": "tool_use", "id": "t1", "name": "lookup", "input": {"q": "x"}})
        self.assertEqual(req["payload"]["messages"][1]["content"], [{"type": "tool_result", "tool_use_id": "t1", "content": "result"}])


class TestAnthropicParseResponse(unittest.TestCase):
    def test_text_and_tool_use(self):
        parsed = anthropic_messages.parse_response(
            {
                "content": [
                    {"type": "text", "text": " answer "},
                    {"type": "tool_use", "id": "tu1", "name": "lookup", "input": {"q": "x"}},
                ],
                "stop_reason": "tool_use",
                "usage": {"input_tokens": 5},
            },
            "r1",
        )
        self.assertEqual(parsed["text"], "answer")
        self.assertEqual(parsed["tool_calls"], [{"tool_call_id": "tu1", "name": "lookup", "arguments": {"q": "x"}}])
        self.assertEqual(parsed["finish_reason"], "tool_calls")

    def test_no_content_raises(self):
        with self.assertRaises(ProviderError):
            anthropic_messages.parse_response({"content": []}, "r1")


class TestAnthropicNormalizeError(unittest.TestCase):
    def test_error_normalization(self):
        err = anthropic_messages.normalize_error({"error": {"type": "authentication_error", "message": "bad key"}}, "r1")
        self.assertEqual(err["code"], "authentication_error")
        self.assertEqual(err["category"], "provider")


if __name__ == "__main__":
    unittest.main()