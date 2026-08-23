"""Test-only RPC methods. Registered ONLY when FASTWORK_RPC_TEST_MODE=1.

Allowed methods (subset needed by frozen GF-RPC fixtures and tests):
ping, test.echo, test.delay_echo, test.hang, test.fail, test.crash,
test.emit_event, test.large_response.
"""
from __future__ import annotations

import asyncio
import os
from typing import TYPE_CHECKING, Any, Dict

from ..errors import WorkerRpcError

if TYPE_CHECKING:
    from ..dispatcher import Dispatcher
    from ..server import RpcServer


def is_test_mode() -> bool:
    return os.environ.get("FASTWORK_RPC_TEST_MODE") == "1"


class TestOnlyMethods:
    def __init__(self, server: "RpcServer") -> None:
        self._server = server

    def register(self, dispatcher: "Dispatcher") -> None:
        if not is_test_mode():
            return  # production mode must not expose test-only methods
        dispatcher.register("ping", self.ping)
        dispatcher.register("test.echo", self.echo)
        dispatcher.register("test.delay_echo", self.delay_echo)
        dispatcher.register("test.hang", self.hang)
        dispatcher.register("test.fail", self.fail)
        dispatcher.register("test.crash", self.crash)
        dispatcher.register("test.emit_event", self.emit_event)
        dispatcher.register("test.large_response", self.large_response)

    async def ping(self, req: Dict[str, Any]) -> Dict[str, Any]:
        # GF-RPC-002/003 expected result shape: {"request_id": ..., "ok": true}
        return {"request_id": req.get("request_id"), "ok": True}

    async def echo(self, req: Dict[str, Any]) -> Any:
        return req.get("payload", {})

    async def delay_echo(self, req: Dict[str, Any]) -> Any:
        payload = req.get("payload") or {}
        delay_ms = int(payload.get("delay_ms", 0) or 0)
        if delay_ms > 0:
            await asyncio.sleep(delay_ms / 1000.0)
        return payload

    async def hang(self, req: Dict[str, Any]) -> Any:
        # Never completes on its own; cooperatively cancellable via system.cancel.
        await asyncio.Event().wait()
        return None  # unreachable

    async def fail(self, req: Dict[str, Any]) -> Any:
        raise WorkerRpcError("internal", "test.fail invoked")

    async def crash(self, req: Dict[str, Any]) -> Any:
        os._exit(1)

    async def emit_event(self, req: Dict[str, Any]) -> Dict[str, Any]:
        ctx = req.get("context") or {}
        self._server.emit_event("test.event", {"echo": req.get("payload", {})}, correlation_id=ctx.get("correlation_id"))
        return {"emitted": True}

    async def large_response(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        size = int(payload.get("size", 256 * 1024) or 0)
        return {"data": "x" * size}
