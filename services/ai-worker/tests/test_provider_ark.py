"""M4 Doubao/Ark adapter tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.adapters import ark
from fastwork_ai_worker.providers.errors import ProviderError


class TestArkBuildRequest(unittest.TestCase):
    def test_defaults_and_payload(self):
        req = ark.build_request({}, [{"role": "user", "content": "hi"}])
        self.assertEqual(req["url"], "https://ark.cn-beijing.volces.com/api/v3/chat/completions")
        self.assertEqual(req["payload"]["model"], "doubao-seed-1-8-251228")
        self.assertEqual(req["payload"]["thinking"], {"type": "disabled"})
        self.assertEqual(req["headers"]["Authorization"], "Bearer <credential_ref>")

    def test_tools_are_included(self):
        tools = [{"type": "function", "function": {"name": "查价"}}]
        req = ark.build_request({"model": "doubao-custom", "credential_ref": "ark-ref"}, [], tools)
        self.assertEqual(req["payload"]["model"], "doubao-custom")
        self.assertEqual(req["payload"]["tools"], tools)
        self.assertEqual(req["payload"]["tool_choice"], "auto")
        self.assertEqual(req["headers"]["Authorization"], "Bearer ark-ref")


class TestArkParseResponse(unittest.TestCase):
    def test_text_and_tool_calls(self):
        parsed = ark.parse_response(
            {
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "tool_calls",
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [
                                {"id": "ark1", "type": "function", "function": {"name": "lookup", "arguments": '{"id":1}'}}
                            ],
                        },
                    }
                ]
            },
            "r1",
        )
        self.assertEqual(parsed["tool_calls"], [{"tool_call_id": "ark1", "name": "lookup", "arguments": {"id": 1}}])
        self.assertEqual(parsed["finish_reason"], "tool_calls")

    def test_no_choices_raises(self):
        with self.assertRaises(ProviderError):
            ark.parse_response({}, "r1")


class TestArkNormalizeError(unittest.TestCase):
    def test_error_normalization(self):
        err = ark.normalize_error({"error": {"code": "ModelNotOpen", "message": "closed"}}, "r1")
        self.assertEqual(err["code"], "ModelNotOpen")
        self.assertEqual(err["category"], "provider")


if __name__ == "__main__":
    unittest.main()