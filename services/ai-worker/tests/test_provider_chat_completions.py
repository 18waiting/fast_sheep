"""M4 chat_completions adapter tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.adapters import chat_completions
from fastwork_ai_worker.providers.errors import ProviderError


class TestChatCompletionsBuildRequest(unittest.TestCase):
    def test_build_request_url_payload_and_headers(self):
        req = chat_completions.build_request(
            {
                "base_url": "https://example.com/v1",
                "model": "gpt-test",
                "credential_ref": "cc-ref",
                "temperature": 0.2,
                "max_output": 700,
            },
            [{"role": "user", "content": "你好"}],
        )
        self.assertEqual(req["url"], "https://example.com/v1/chat/completions")
        self.assertEqual(req["headers"]["Content-Type"], "application/json")
        self.assertEqual(req["headers"]["Authorization"], "Bearer cc-ref")
        self.assertEqual(req["payload"]["model"], "gpt-test")
        self.assertEqual(req["payload"]["temperature"], 0.2)
        self.assertEqual(req["payload"]["max_tokens"], 700)
        self.assertEqual(req["payload"]["thinking"], {"type": "disabled"})
        self.assertNotIn("tools", req["payload"])

    def test_build_request_tools_adds_tool_choice_auto(self):
        tools = [{"type": "function", "function": {"name": "查价"}}]
        req = chat_completions.build_request({"base_url": "https://example.com", "model": "m"}, [], tools)
        self.assertEqual(req["payload"]["tools"], tools)
        self.assertEqual(req["payload"]["tool_choice"], "auto")


class TestChatCompletionsParseResponse(unittest.TestCase):
    def test_text_response(self):
        parsed = chat_completions.parse_response(
            {
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {"role": "assistant", "content": "  hi  "},
                    }
                ],
                "usage": {"total_tokens": 3},
            },
            "r1",
        )
        self.assertEqual(parsed["text"], "hi")
        self.assertEqual(parsed["finish_reason"], "stop")
        self.assertEqual(parsed["tool_calls"], [])
        self.assertEqual(parsed["usage"], {"total_tokens": 3})

    def test_tool_calls_are_canonical(self):
        parsed = chat_completions.parse_response(
            {
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "tool_calls",
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [
                                {
                                    "id": "call_1",
                                    "type": "function",
                                    "function": {
                                        "name": "get_weather",
                                        "arguments": '{"city": "上海"}',
                                    },
                                }
                            ],
                        },
                    }
                ]
            },
            "r1",
        )
        self.assertEqual(parsed["finish_reason"], "tool_calls")
        self.assertEqual(parsed["tool_calls"], [{"tool_call_id": "call_1", "name": "get_weather", "arguments": {"city": "上海"}}])

    def test_malformed_tool_arguments_still_becomes_tool_call(self):
        parsed = chat_completions.parse_response(
            {
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "tool_calls",
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [
                                {"id": "call_bad", "type": "function", "function": {"name": "bad", "arguments": "{not json"}}
                            ],
                        },
                    }
                ]
            },
            "r1",
        )
        self.assertEqual(parsed["tool_calls"][0]["tool_call_id"], "call_bad")
        self.assertEqual(parsed["tool_calls"][0]["name"], "bad")
        self.assertEqual(parsed["tool_calls"][0]["arguments"], {})
        self.assertEqual(parsed["tool_calls"][0]["error"], "malformed_tool_arguments")

    def test_no_content_or_tools_raises(self):
        with self.assertRaises(ProviderError):
            chat_completions.parse_response(
                {"choices": [{"index": 0, "message": {"role": "assistant", "content": ""}}]}, "r1"
            )

    def test_error_body_raises(self):
        with self.assertRaises(ProviderError):
            chat_completions.parse_response({"error": {"message": "boom"}}, "r1")


class TestChatCompletionsNormalizeError(unittest.TestCase):
    def test_error_normalization(self):
        err = chat_completions.normalize_error(
            {"error": {"code": "rate_limit", "message": "slow down", "retryable": True}}, "r1"
        )
        self.assertEqual(err["code"], "rate_limit")
        self.assertEqual(err["category"], "provider")
        self.assertEqual(err["retryable"], True)
        self.assertEqual(err["request_id"], "r1")


if __name__ == "__main__":
    unittest.main()