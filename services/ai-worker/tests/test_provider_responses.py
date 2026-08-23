"""M4 Responses API adapter tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.adapters import responses
from fastwork_ai_worker.providers.errors import ProviderError


class TestResponsesBuildRequest(unittest.TestCase):
    def test_build_request_url_headers_and_instructions(self):
        req = responses.build_request(
            {
                "base_url": "https://example.com/v1",
                "model": "resp-model",
                "credential_ref": "resp-ref",
                "temperature": 0.4,
                "max_output": 900,
            },
            [
                {"role": "system", "content": "system prompt"},
                {"role": "user", "content": "hello"},
            ],
        )
        self.assertEqual(req["url"], "https://example.com/v1/responses")
        self.assertEqual(req["headers"]["Authorization"], "Bearer resp-ref")
        self.assertEqual(req["payload"]["model"], "resp-model")
        self.assertEqual(req["payload"]["instructions"], "system prompt")
        self.assertEqual(req["payload"]["input"], [{"type": "message", "role": "user", "content": [{"type": "input_text", "text": "hello"}]}])

    def test_tools_are_converted(self):
        tools = [{"type": "function", "function": {"name": "lookup", "description": "d", "parameters": {}}}]
        req = responses.build_request({"base_url": "https://example.com", "model": "m"}, [], tools)
        self.assertEqual(req["payload"]["tools"][0]["type"], "function")
        self.assertEqual(req["payload"]["tools"][0]["name"], "lookup")
        self.assertEqual(req["payload"]["tool_choice"], "auto")


class TestResponsesParseResponse(unittest.TestCase):
    def test_text_from_message_items(self):
        parsed = responses.parse_response(
            {
                "output": [
                    {"type": "message", "content": [{"type": "output_text", "text": " first "}]},
                    {"type": "message", "content": [{"type": "output_text", "text": "second"}]},
                ],
                "status": "completed",
                "usage": {"input_tokens": 2},
            },
            "r1",
        )
        self.assertEqual(parsed["text"], "first\nsecond")
        self.assertEqual(parsed["finish_reason"], "stop")
        self.assertEqual(parsed["tool_calls"], [])

    def test_function_call_is_canonical(self):
        parsed = responses.parse_response(
            {
                "output": [
                    {"type": "function_call", "call_id": "fc1", "name": "get_weather", "arguments": '{"city": "北京"}'}
                ],
                "status": "in_progress",
            },
            "r1",
        )
        self.assertEqual(parsed["tool_calls"], [{"tool_call_id": "fc1", "name": "get_weather", "arguments": {"city": "北京"}}])
        self.assertEqual(parsed["finish_reason"], "tool_calls")

    def test_function_call_output_is_ignored(self):
        with self.assertRaises(ProviderError):
            responses.parse_response(
                {"output": [{"type": "function_call_output", "call_id": "fc1", "output": "{}"}]},
                "r1",
            )


class TestResponsesNormalizeError(unittest.TestCase):
    def test_error_normalization(self):
        err = responses.normalize_error({"error": {"type": "invalid_request_error", "message": "bad"}}, "r1")
        self.assertEqual(err["code"], "invalid_request_error")
        self.assertEqual(err["category"], "provider")


if __name__ == "__main__":
    unittest.main()