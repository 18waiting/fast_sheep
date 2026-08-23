"""M4 result_normalizer tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.result_normalizer import normalize


class TestResultNormalizer(unittest.TestCase):
    def test_success_chat_completions(self):
        out = normalize(
            {"choices": [{"index": 0, "finish_reason": "stop", "message": {"content": "你好"}}]},
            "chat_completions",
            "r1",
        )
        self.assertTrue(out["ok"])
        self.assertIsNone(out["error"])
        self.assertEqual(out["result"]["request_id"], "r1")
        self.assertEqual(out["result"]["text"], "你好")
        self.assertEqual(out["result"]["finish_reason"], "stop")
        self.assertEqual(out["result"]["tool_calls"], [])

    def test_success_tool_calls(self):
        out = normalize(
            {
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "tool_calls",
                        "message": {
                            "content": "",
                            "tool_calls": [
                                {"id": "c1", "type": "function", "function": {"name": "t", "arguments": '{"a":1}'}}
                            ],
                        },
                    }
                ]
            },
            "chat_completions",
            "r2",
        )
        self.assertTrue(out["ok"])
        self.assertEqual(out["result"]["tool_calls"], [{"tool_call_id": "c1", "name": "t", "arguments": {"a": 1}}])

    def test_error_response(self):
        out = normalize({"error": {"code": "boom", "message": "bad"}}, "chat_completions", "r3")
        self.assertFalse(out["ok"])
        self.assertIsNone(out["result"])
        self.assertEqual(out["error"]["category"], "provider")
        self.assertEqual(out["error"]["code"], "boom")

    def test_unknown_protocol(self):
        out = normalize({}, "weird", "r4")
        self.assertFalse(out["ok"])
        self.assertEqual(out["error"]["category"], "config")
        self.assertEqual(out["error"]["code"], "unknown_protocol")


if __name__ == "__main__":
    unittest.main()