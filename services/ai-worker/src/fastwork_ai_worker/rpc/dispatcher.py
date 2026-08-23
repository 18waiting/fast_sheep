"""Method registration, lookup, task creation, and structured exception conversion.

No AI/business methods live here. The server drives dispatch; this module owns the
method table and the per-request task lifecycle.
"""
from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple, Union

from .cancellation import CancellationRegistry
from .errors import WorkerRpcError, error_response, ok_response
from .framing import log_stderr
from .protocol import assert_version_supported, validate_request

Handler = Callable[[Dict[str, Any]], Awaitable[Any]]


class Dispatcher:
    def __init__(self, cancellation: Optional[CancellationRegistry] = None) -> None:
        self._methods: Dict[str, Handler] = {}
        self._cancellation = cancellation or CancellationRegistry()

    @property
    def cancellation(self) -> CancellationRegistry:
        return self._cancellation

    def register(self, name: str, handler: Handler) -> None:
        self._methods[name] = handler

    def unregister(self, name: str) -> None:
        self._methods.pop(name, None)

    def has(self, name: str) -> bool:
        return name in self._methods

    def names(self) -> List[str]:
        return sorted(self._methods.keys())

    def resolve(self, req: Dict[str, Any]) -> Tuple[Optional[str], Optional[Handler], Optional[WorkerRpcError]]:
        """Validate version + envelope and look up the handler.

        Returns (request_id, handler, error). Exactly one of handler/error is set.
        """
        try:
            assert_version_supported(req)
        except WorkerRpcError as e:
            return None, None, e
        ok, errs = validate_request(req)
        if not ok:
            return None, None, WorkerRpcError("protocol_error", "; ".join(errs))
        method = str(req.get("method", ""))
        handler = self._methods.get(method)
        if handler is None:
            return None, None, WorkerRpcError("method.unknown", f"unknown method: {method}")
        return str(req.get("request_id", "")), handler, None

    def schedule(self, req: Dict[str, Any], handler: Handler, respond: Callable[[Dict[str, Any]], None]) -> Optional[asyncio.Task]:
        """Create and track the handler task. Returns None on duplicate request_id."""
        request_id = str(req["request_id"])

        async def run() -> None:
            try:
                result = await handler(req)
                respond(ok_response(request_id, result))
            except asyncio.CancelledError:
                respond(error_response(request_id, WorkerRpcError("cancelled", "request cancelled", category="cancelled")))
            except WorkerRpcError as e:
                respond(error_response(request_id, e))
            except Exception as e:  # noqa: BLE001 - sanitized; never a traceback on stdout
                from ..rag.errors import RagError

                if isinstance(e, RagError):
                    respond(error_response(request_id, WorkerRpcError(e.code, e.message, category=e.category, retryable=e.retryable)))
                else:
                    log_stderr(f"handler {req.get('method')!r} error: {type(e).__name__}: {e}")
                    respond(error_response(request_id, WorkerRpcError("internal", "internal handler error", category="internal")))

        task = asyncio.create_task(run())
        if not self._cancellation.register(request_id, task):
            task.cancel()
            return None
        task.add_done_callback(lambda _t: self._cancellation.remove(request_id))
        return task
