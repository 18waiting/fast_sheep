"""M4 SiliconFlow adapter tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.providers.adapters import siliconflow
from fastwork_ai_worker.providers.errors import ProviderError


class TestSiliconFlowBuildRequest(unittest.TestCase):
    def test_default_url_and_no_thinking(self):
        req = siliconflow.build_request({"model": "deepseek-ai/DeepSeek-V3", "credential_ref": "sf-ref"}, [])
        self.assertEqual(req["url"], "https://api.siliconflow.cn/v1/chat/completions")
        self.assertEqual(req["headers"]["Authorization"], "Bearer sf-ref")
        self.assertEqual(req["payload"]["model"], "deepseek-ai/DeepSeek-V3")
        self.assertNotIn("thinking", req["payload"])

    def test_tools_added_when_present(self):
        tools = [{"type": "function", "function": {"name": "lookup"}}]
        req = siliconflow.build_request({"base_url": "https://x.example/v1", "model": "m"}, [], tools)
        self.assertEqual(req["url"], "https://x.example/v1/chat/completions")
        self.assertEqual(req["payload"]["tool_choice"], "auto")


class TestSiliconFlowParseResponse(unittest.TestCase):
    def test_text_response(self):
        parsed = siliconflow.parse_response(
            {"choices": [{"index": 0, "finish_reason": "stop", "message": {"content": " hi "}}], "model": "m"},
            "r1",
        )
        self.assertEqual(parsed["text"], "hi")
        self.assertNotIn("model", parsed)
        self.assertEqual(parsed["finish_reason"], "stop")

    def test_error_raises(self):
        with self.assertRaises(ProviderError):
            siliconflow.parse_response({"error": {"message": "bad"}}, "r1")


class TestSiliconFlowNormalizeError(unittest.TestCase):
    def test_error_normalization(self):
        err = siliconflow.normalize_error({"error": {"message": "timeout"}}, "r1")
        self.assertEqual(err["category"], "provider")
        self.assertEqual(err["request_id"], "r1")


if __name__ == "__main__":
    unittest.main()