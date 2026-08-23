"""M2 system infrastructure methods: system.health, system.cancel, system.shutdown.

No business operations.
"""
from __future__ import annotations

import os
import time
from typing import TYPE_CHECKING, Any, Dict

from ..._version import __version__
from ..constants import RPC_PROTOCOL_VERSION
from ..errors import WorkerRpcError
from ..protocol import validate_cancel_payload, validate_health_result

if TYPE_CHECKING:
    from ..dispatcher import Dispatcher
    from ..server import RpcServer


class SystemMethods:
    def __init__(self, server: "RpcServer") -> None:
        self._server = server
        self._started = time.monotonic()

    def register(self, dispatcher: "Dispatcher") -> None:
        dispatcher.register("system.health", self.health)
        dispatcher.register("system.cancel", self.cancel)
        dispatcher.register("system.shutdown", self.shutdown)

    async def health(self, req: Dict[str, Any]) -> Dict[str, Any]:
        result = {
            "status": "ok",
            "worker_version": __version__,
            "protocol_version": RPC_PROTOCOL_VERSION,
            "pid": os.getpid(),
            "uptime_ms": int((time.monotonic() - self._started) * 1000),
        }
        ok, errs = validate_health_result(result)
        if not ok:
            raise WorkerRpcError("internal", "; ".join(errs))
        return result

    async def cancel(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        ok, errs = validate_cancel_payload(payload)
        if not ok:
            raise WorkerRpcError("protocol_error", "; ".join(errs))
        target = payload["target_request_id"]
        found = self._server.cancellation.cancel(target)
        return {"request_id": target, "cancelled": found, "already_completed": not found}

    async def shutdown(self, req: Dict[str, Any]) -> Dict[str, Any]:
        self._server.request_shutdown()
        return {"ok": True, "exit_code": 0, "reason": "graceful"}
