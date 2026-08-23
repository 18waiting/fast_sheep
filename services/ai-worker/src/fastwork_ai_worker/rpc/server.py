"""stdio JSONL RPC server for the M2 AI worker.

Responsibilities: ready event, stdin loop, validation, dispatch, concurrent task
lifecycle, response output, protocol-error events, and graceful shutdown.
No AI/business methods. No listening socket.
"""
from __future__ import annotations

import asyncio
import os
import sys
from typing import Any, Callable, Dict, Optional, Set

from .._version import __version__
from .cancellation import CancellationRegistry
from .constants import (
    DEFAULT_MAX_FRAME_BYTES,
    DEFAULT_MAX_INFLIGHT,
    READY_EVENT,
    RPC_PROTOCOL_VERSION,
)
from .dispatcher import Dispatcher
from .errors import WorkerRpcError, error_response
from .framing import log_stderr, parse_line, write_frame
from .methods.conversation import ConversationMethods
from .methods.handoff import HandoffMethods
from .methods.feedback import FeedbackMethods
from .methods.learning import LearningMethods
from .methods.review import ReviewMethods
from .methods.audit import AuditMethods
from .methods.optimization import OptimizationMethods
from .methods.legacy_import import LegacyImportMethods
from .methods.m4_engine import M4EngineMethods
from .methods.m4_test_only import M4TestOnlyMethods
from .methods.rag import RagMethods
from .methods.system import SystemMethods
from .methods.test_only import TestOnlyMethods
from .protocol import validate_ready_payload


class RpcServer:
    def __init__(
        self,
        *,
        max_frame_bytes: int = DEFAULT_MAX_FRAME_BYTES,
        max_inflight: int = DEFAULT_MAX_INFLIGHT,
        stdin: Optional[Any] = None,
        stdout: Optional[Any] = None,
    ) -> None:
        self._max_frame_bytes = max_frame_bytes
        self._max_inflight = max_inflight
        self._stdin = stdin if stdin is not None else sys.stdin.buffer
        self._stdout = stdout if stdout is not None else sys.stdout
        self._dispatcher = Dispatcher()
        self._cancellation: CancellationRegistry = self._dispatcher.cancellation
        self._active: Set[asyncio.Task] = set()
        self._shutdown_requested = False
        self._write_lock = asyncio.Lock()
        SystemMethods(self).register(self._dispatcher)
        RagMethods(self).register(self._dispatcher)
        ConversationMethods(self).register(self._dispatcher)
        HandoffMethods(self).register(self._dispatcher)
        FeedbackMethods(self).register(self._dispatcher)
        LearningMethods(self).register(self._dispatcher)
        ReviewMethods(self).register(self._dispatcher)
        AuditMethods(self).register(self._dispatcher)
        OptimizationMethods(self).register(self._dispatcher)
        LegacyImportMethods(self).register(self._dispatcher)
        M4EngineMethods(self).register(self._dispatcher)
        M4TestOnlyMethods(self).register(self._dispatcher)
        TestOnlyMethods(self).register(self._dispatcher)

    @property
    def cancellation(self) -> CancellationRegistry:
        return self._cancellation

    @property
    def dispatcher(self) -> Dispatcher:
        return self._dispatcher

    def request_shutdown(self) -> None:
        self._shutdown_requested = True

    def emit_event(self, event: str, payload: Dict[str, Any], correlation_id: Optional[str] = None) -> None:
        frame = {"event": event, "payload": payload}
        if correlation_id is not None:
            frame["correlation_id"] = correlation_id
        self._write(frame)

    def _write(self, frame: Dict[str, Any]) -> None:
        # Writes happen on the event-loop thread; the lock serializes concurrent
        # task completions so protocol frames never interleave.
        async def _do() -> None:
            async with self._write_lock:
                write_frame(self._stdout, frame, self._max_frame_bytes)
        asyncio.create_task(_do())

    async def _read_line(self) -> bytes:
        return await asyncio.to_thread(self._stdin.readline)

    async def run(self) -> int:
        await self._emit_ready()
        while not self._shutdown_requested:
            line = await self._read_line()
            if line == b"":
                break  # stdin EOF: parent closed the pipe
            self._handle_line(line)
        # Graceful shutdown: cancel in-flight infrastructure tasks and let responses flush.
        self._cancellation.cancel_all()
        await asyncio.sleep(0.05)
        return 0

    async def _emit_ready(self) -> None:
        payload = {
            "version": RPC_PROTOCOL_VERSION,
            "worker_version": __version__,
            "protocol_versions": [RPC_PROTOCOL_VERSION],
            "pid": os.getpid(),
            "python_version": sys.version.split()[0],
            "capabilities": [],
        }
        ok, errs = validate_ready_payload(payload)
        if not ok:
            raise RuntimeError("invalid ready payload: " + "; ".join(errs))
        self._write({"event": READY_EVENT, "payload": payload})

    def _handle_line(self, line: bytes) -> None:
        size = len(line)
        if size > self._max_frame_bytes:
            log_stderr(f"oversize frame skipped: {size} > {self._max_frame_bytes}")
            self.emit_event(
                "rpc.protocol_error",
                {"reason": "frame_too_large", "code": "payload.oversize", "frame_bytes": size, "max_frame_bytes": self._max_frame_bytes},
            )
            return
        text = line.decode("utf-8", errors="replace")
        if not text.strip():
            return
        obj = parse_line(text)
        if obj is None:
            # GF-RPC-005: skip the malformed line and log (worker must not crash).
            log_stderr("malformed JSON line skipped")
            return
        if not isinstance(obj, dict) or "request_id" not in obj or "method" not in obj:
            log_stderr("non-request frame skipped")
            return
        self._handle_request(obj)

    def _handle_request(self, req: Dict[str, Any]) -> None:
        request_id, handler, err = self._dispatcher.resolve(req)
        rid = req.get("request_id")
        correlated_id = str(rid) if isinstance(rid, str) and rid else None
        if err is not None:
            if correlated_id:
                self._write(error_response(correlated_id, err))
            else:
                self.emit_event("rpc.protocol_error", {"reason": err.code, "code": err.code})
            return
        method = req.get("method", "")
        is_control = isinstance(method, str) and method.startswith("system.")
        if not is_control and len(self._active) >= self._max_inflight:
            # GF-RPC-011: bounded queue -> immediate backpressure rejection.
            # Infrastructure control (system.*) always bypasses the in-flight limit.
            self._write(error_response(correlated_id or "", WorkerRpcError("backpressure", "max in-flight reached")))
            return
        task = self._dispatcher.schedule(req, handler, respond=self._respond)
        if task is None:
            self._write(error_response(correlated_id or "", WorkerRpcError("protocol_error", "duplicate request id")))
            return
        self._active.add(task)
        task.add_done_callback(lambda t: self._active.discard(t))

    def _respond(self, frame: Dict[str, Any]) -> None:
        self._write(frame)


async def serve_stdio(
    *,
    max_frame_bytes: int = DEFAULT_MAX_FRAME_BYTES,
    max_inflight: int = DEFAULT_MAX_INFLIGHT,
    stdin: Optional[Any] = None,
    stdout: Optional[Any] = None,
) -> int:
    """Run the worker RPC server to completion. Returns the process exit code."""
    server = RpcServer(max_frame_bytes=max_frame_bytes, max_inflight=max_inflight, stdin=stdin, stdout=stdout)
    return await server.run()
