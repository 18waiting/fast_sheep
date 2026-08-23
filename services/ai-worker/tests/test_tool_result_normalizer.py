"""ToolResultNormalizer tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.tools.tool_result_normalizer import error_result, normalize_result


class TestToolResultNormalizer(unittest.TestCase):
    def test_normalize_shape(self):
        out = normalize_result("call_1", True, result={"rows": 2}, text="ok")
        self.assertEqual(set(out), {"tool_call_id", "ok", "result", "text", "error"})
        self.assertEqual(out["tool_call_id"], "call_1")
        self.assertTrue(out["ok"])
        self.assertEqual(out["result"], {"rows": 2})
        self.assertEqual(out["text"], "ok")
        self.assertIsNone(out["error"])

    def test_normalize_defaults(self):
        out = normalize_result("call_1", False)
        self.assertEqual(out["result"], {})
        self.assertEqual(out["text"], "")
        self.assertIsNone(out["error"])

    def test_error_result(self):
        out = error_result("call_2", "tool.unknown")
        self.assertFalse(out["ok"])
        self.assertEqual(out["error"]["code"], "tool.unknown")
        self.assertEqual(out["error"]["category"], "tool")
        self.assertEqual(out["error"]["message"], "")

    def test_error_result_custom_category(self):
        out = error_result("c", "sec.unsigned", category="security", message="unsigned")
        self.assertEqual(out["error"], {"code": "sec.unsigned", "category": "security", "message": "unsigned"})


if __name__ == "__main__":
    unittest.main()
