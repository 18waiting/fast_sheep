"""Generation provider protocol (TASK-019 M4).

The provider subsystem only moves data.  Implementations return a
GenerationResult-shaped dict and must never open network clients or sockets.
"""
from __future__ import annotations

from typing import Any, Dict, Protocol, runtime_checkable


@runtime_checkable
class GenerationProvider(Protocol):
    """Interface implemented by deterministic and real generation providers."""

    def generate(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Produce a GenerationResult-shaped dict for ``request``.

        ``request`` follows the clean-room GenerationRequest shape:
        ``{request_id, messages, tools?, ...}``.
        """
        ...