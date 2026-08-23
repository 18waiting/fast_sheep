"""M2 RPC server tests over a fake stdio: ready, correlation, concurrency,
version/method errors, malformed/oversize handling, backpressure, shutdown."""
import asyncio
import json
import os
import sys
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Server tests exercise test-only methods (ping/hang/delay_echo); enable test mode.
os.environ["FASTWORK_RPC_TEST_MODE"] = "1"

from fastwork_ai_worker.rpc.server import RpcServer


class FakeStdin:
    """Blocking stdin substitute; feed() queues lines, close() signals EOF."""
    def __init__(self):
        self.lines = []
        self.closed = False

    def feed(self, line):
        self.lines.append(line.encode("utf-8") + b"\n")

    def feed_raw(self, data):
        self.lines.append(data.encode("utf-8") + b"\n")

    def close(self):
        self.closed = True

    def readline(self):
        deadline = time.monotonic() + 10.0  # bounded wait: never hang a thread forever
        while not self.lines and not self.closed:
            if time.monotonic() > deadline:
                return b""
            time.sleep(0.005)
        if not self.lines:
            return b""
        return self.lines.pop(0)


class FakeStdout:
    def __init__(self):
        self.chunks = []

    def write(self, s):
        self.chunks.append(s)

    def flush(self):
        pass

    def text(self):
        return "".join(self.chunks)

    def frames(self):
        out = []
        for line in self.text().splitlines():
            if line.strip():
                out.append(json.loads(line))
        return out


class RpcHarness:
    def __init__(self, max_frame_bytes=1024 * 1024, max_inflight=8):
        self.stdin = FakeStdin()
        self.stdout = FakeStdout()
        self.server = RpcServer(max_frame_bytes=max_frame_bytes, max_inflight=max_inflight, stdin=self.stdin, stdout=self.stdout)
        self.task = None

    async def start(self):
        self.task = asyncio.create_task(self.server.run())

    def send(self, obj):
        self.stdin.feed(json.dumps(obj, ensure_ascii=False))

    def send_raw(self, text):
        self.stdin.feed_raw(text)

    async def wait_frames(self, n, timeout=3.0):
        start = time.monotonic()
        while len(self.stdout.frames()) < n:
            if time.monotonic() - start > timeout:
                raise TimeoutError(f"expected {n} frames, got {len(self.stdout.frames())}")
            await asyncio.sleep(0.01)
        return self.stdout.frames()

    async def stop(self):
        self.stdin.close()
        if self.task:
            try:
                await asyncio.wait_for(self.task, 5.0)
            except asyncio.TimeoutError:
                self.task.cancel()
                try:
                    await self.task
                except (asyncio.CancelledError, Exception):
                    pass


def req(rid, method, payload=None, version=1, context=None):
    return {"version": version, "request_id": rid, "method": method, "payload": payload or {}, "context": context or {"shop_id": "", "correlation_id": "c-" + rid}}


class TestRpcServer(unittest.IsolatedAsyncioTestCase):
    async def test_ready_event_first(self):
        h = RpcHarness()
        await h.start()
        try:
            frames = await h.wait_frames(1)
            self.assertEqual(frames[0]["event"], "worker.ready")
            self.assertEqual(frames[0]["payload"]["version"], 1)
            self.assertIn(1, frames[0]["payload"]["protocol_versions"])
        finally:
            await h.stop()

    async def test_health(self):
        h = RpcHarness()
        await h.start()
        try:
            await h.wait_frames(1)
            h.send(req("r1", "system.health"))
            frames = await h.wait_frames(2)
            resp = frames[1]
            self.assertTrue(resp["ok"])
            self.assertEqual(resp["result"]["status"], "ok")
            self.assertEqual(resp["result"]["protocol_version"], 1)
        finally:
            await h.stop()

    async def test_ping_correlation(self):
        h = RpcHarness()
        await h.start()
        try:
            await h.wait_frames(1)
            h.send(req("r1", "ping"))
            h.send(req("r2", "ping"))
            frames = await h.wait_frames(3)
            resps = {f["request_id"]: f for f in frames if "request_id" in f}
            self.assertTrue(resps["r1"]["ok"])
            self.assertTrue(resps["r2"]["ok"])
            self.assertEqual(resps["r1"]["result"]["request_id"], "r1")
            self.assertEqual(resps["r2"]["result"]["request_id"], "r2")
        finally:
            await h.stop()

    async def test_out_of_order_responses(self):
        h = RpcHarness()
        await h.start()
        try:
            await h.wait_frames(1)
            h.send(req("r1", "test.delay_echo", {"delay_ms": 300, "tag": "slow"}))
            h.send(req("r2", "ping"))
            frames = await h.wait_frames(3)
            resps = [f for f in frames if "request_id" in f]
            # r2 (fast) must be emitted before r1 (slow): out-of-order correlation by request_id
            self.assertEqual(resps[0]["request_id"], "r2")
            self.assertEqual(resps[1]["request_id"], "r1")
        finally:
            await h.stop()

    async def test_unknown_version(self):
        h = RpcHarness()
        await h.start()
        try:
            await h.wait_frames(1)
            h.send(req("r1", "ping", version=99))
            frames = await h.wait_frames(2)
            resp = frames[1]
            self.assertFalse(resp["ok"])
            self.assertEqual(resp["error"]["code"], "version.unsupported")
        finally:
            await h.stop()

    async def test_unknown_method(self):
        h = RpcHarness()
        await h.start()
        try:
            await h.wait_frames(1)
            h.send(req("r1", "no_such_method"))
            frames = await h.wait_frames(2)
            self.assertEqual(frames[1]["error"]["code"], "method.unknown")
        finally:
            await h.stop()

    async def test_malformed_line_skipped(self):
        h = RpcHarness()
        await h.start()
        try:
            await h.wait_frames(1)
            h.send_raw("{bad json")
            h.send(req("r1", "ping"))
            frames = await h.wait_frames(2)
            self.assertTrue(frames[1]["ok"])
        finally:
            await h.stop()

    async def test_oversize_frame_protocol_error_event(self):
        h = RpcHarness(max_frame_bytes=256)  # ready payload must still fit
        await h.start()
        try:
            await h.wait_frames(1)
            h.send_raw(json.dumps({"data": "x" * 600}))
            frames = await h.wait_frames(2)
            self.assertEqual(frames[1]["event"], "rpc.protocol_error")
            self.assertEqual(frames[1]["payload"]["code"], "payload.oversize")
            h.send(req("r1", "ping"))
            frames = await h.wait_frames(3)
            self.assertTrue(frames[2]["ok"])
        finally:
            await h.stop()

    async def test_backpressure_bounded(self):
        h = RpcHarness(max_inflight=1)
        await h.start()
        try:
            await h.wait_frames(1)
            h.send(req("r1", "test.hang"))
            await asyncio.sleep(0.05)
            h.send(req("r2", "ping"))
            frames = await h.wait_frames(2)
            resp = frames[1]
            self.assertFalse(resp["ok"])
            self.assertEqual(resp["error"]["code"], "backpressure")
            # cleanup: cancel the hang (system.* bypasses backpressure)
            h.send(req("r3", "system.cancel", {"target_request_id": "r1"}))
            frames = await h.wait_frames(4)
            self.assertTrue(any(f.get("request_id") == "r1" and not f["ok"] and f["error"]["code"] == "cancelled" for f in frames))
        finally:
            await h.stop()

    async def test_shutdown_responds_then_exits(self):
        h = RpcHarness()
        await h.start()
        try:
            await h.wait_frames(1)
            h.send(req("r1", "system.shutdown"))
            frames = await h.wait_frames(2)
            self.assertTrue(frames[1]["ok"])
            self.assertEqual(frames[1]["result"]["exit_code"], 0)
        finally:
            await h.stop()

    async def test_duplicate_request_id_rejected(self):
        h = RpcHarness()
        await h.start()
        try:
            await h.wait_frames(1)
            h.send(req("r1", "test.delay_echo", {"delay_ms": 200}))
            await asyncio.sleep(0.05)
            h.send(req("r1", "ping"))
            frames = await h.wait_frames(3)
            dup = [f for f in frames if "request_id" in f and not f["ok"] and f["error"]["code"] == "protocol_error"]
            self.assertEqual(len(dup), 1)
        finally:
            await h.stop()


if __name__ == "__main__":
    unittest.main()
