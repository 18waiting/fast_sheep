"""Deterministic offline transport (TASK-019 M4).

No sockets, no DNS, no HTTP.  The mock returns configured raw response dicts so
adapter normalization and provider orchestration can be exercised offline.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


class MockProviderTransport:
    def __init__(
        self,
        responses: Optional[List[Dict[str, Any]]] = None,
        call_log: Optional[list] = None,
        error: Optional[str] = None,
    ):
        self.responses = list(responses or [])
        self.call_log = call_log if call_log is not None else []
        self.error = error
        self._next = 0

    def request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        self.call_log.append(("transport", request))
        if self.error is not None:
            return {"error": {"message": self.error}}
        if not self.responses:
            return {
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "mock transport response"},
                        "finish_reason": "stop",
                    }
                ]
            }
        idx = min(self._next, len(self.responses) - 1)
        self._next += 1
        return self.responses[idx]

    def send(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Alias for ``request`` used by some transport consumers."""
        return self.request(request)