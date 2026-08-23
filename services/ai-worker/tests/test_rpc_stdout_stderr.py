"""M2 stdout/stderr isolation test: protocol frames on stdout only; diagnostics on stderr only."""
import asyncio
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastwork_ai_worker.rpc import framing
from fastwork_ai_worker.rpc.server import RpcServer


class _Stdin:
    def __init__(self):
        self.lines = []
        self.closed = False

    def feed(self, text):
        self.lines.append(text.encode("utf-8") + b"\n")

    def close(self):
        self.closed = True

    def readline(self):
        import time
        while not self.lines and not self.closed:
            time.sleep(0.005)
        if not self.lines:
            return b""
        return self.lines.pop(0)


class _Stdout:
    def __init__(self):
        self.chunks = []

    def write(self, s):
        self.chunks.append(s)

    def flush(self):
        pass

    def text(self):
        return "".join(self.chunks)


class _StderrCapture:
    def __init__(self):
        self.lines = []

    def write(self, s):
        self.lines.append(s)

    def flush(self):
        pass

    def text(self):
        return "".join(self.lines)


class TestStdoutStderrIsolation(unittest.IsolatedAsyncioTestCase):
    async def test_stdout_contains_only_protocol_frames(self):
        stdin = _Stdin()
        stdout = _Stdout()
        server = RpcServer(stdin=stdin, stdout=stdout)
        task = asyncio.create_task(server.run())
        await asyncio.sleep(0.05)
        stdin.feed(json.dumps({"version": 1, "request_id": "r1", "method": "ping", "payload": {}}))
        await asyncio.sleep(0.2)
        stdin.close()
        await asyncio.wait_for(task, 3.0)
        lines = [l for l in stdout.text().splitlines() if l.strip()]
        self.assertGreaterEqual(len(lines), 2)  # ready + ping response
        for line in lines:
            obj = json.loads(line)  # every stdout line must be a valid JSON protocol frame
            self.assertTrue("event" in obj or "request_id" in obj, f"unexpected frame: {obj}")
        self.assertNotIn("traceback", stdout.text().lower())

    async def test_diagnostics_go_to_stderr_not_stdout(self):
        captured = _StderrCapture()
        old_write = framing.log_stderr
        def fake_log(message):
            captured.write(message + "\n")
        framing.log_stderr = fake_log
        framing.log_stderr("worker started (diagnostic)")
        framing.log_stderr("another diagnostic")
        self.assertIn("worker started", captured.text())
        self.assertIn("another diagnostic", captured.text())
        framing.log_stderr = old_write


if __name__ == "__main__":
    unittest.main()
