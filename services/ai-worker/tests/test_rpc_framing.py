"""M2 JSONL framing tests: stdout protocol-only, stderr diagnostics-only, size limits."""
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rpc import framing
from fastwork_ai_worker.rpc.errors import WorkerRpcError


class TestFraming(unittest.TestCase):
    def test_encode_frame_newline(self):
        line = framing.encode_frame({"a": 1})
        self.assertTrue(line.endswith("\n") is False)
        self.assertEqual(json.loads(line), {"a": 1})

    def test_encode_frame_oversize_raises(self):
        with self.assertRaises(WorkerRpcError) as ctx:
            framing.encode_frame({"data": "x" * 4096}, max_frame_bytes=16)
        self.assertEqual(ctx.exception.code, "payload.oversize")

    def test_write_frame_goes_to_stdout_stream(self):
        out = io.StringIO()
        framing.write_frame(out, {"event": "x", "payload": {}})
        self.assertEqual(out.getvalue().strip(), json.dumps({"event": "x", "payload": {}}, ensure_ascii=False, separators=(",", ":")))

    def test_log_stderr_writes_to_stderr(self):
        err = io.StringIO()
        old = sys.stderr
        sys.stderr = err
        try:
            framing.log_stderr("diag line")
        finally:
            sys.stderr = old
        self.assertIn("diag line", err.getvalue())

    def test_parse_line_ok(self):
        self.assertEqual(framing.parse_line('{"a":1}'), {"a": 1})

    def test_parse_line_malformed_returns_none(self):
        self.assertIsNone(framing.parse_line("{bad json"))

    def test_parse_line_blank_returns_none(self):
        self.assertIsNone(framing.parse_line("   "))


if __name__ == "__main__":
    unittest.main()
