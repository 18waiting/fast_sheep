"""Provider transport protocol (TASK-019 M4).

The interface exists so a future real HTTP transport can replace the offline
mock without changing the rest of the provider subsystem.  M4 itself must not
perform network I/O.
"""
from __future__ import annotations

from typing import Any, Dict, Protocol, runtime_checkable


@runtime_checkable
class ProviderTransport(Protocol):
    """Data-only transport interface."""

    def request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Return a raw provider response dict for a built request envelope."""
        ...