"""Runtime policy for tool subprocesses."""
from __future__ import annotations

from typing import Any, Dict


class SandboxPolicy:
    """Declarative sandbox capabilities and limits."""

    def __init__(
        self,
        network: bool = False,
        data_read_only: bool = True,
        timeout_ms: int = 5000,
        output_limit: int = 65536,
        allow_unsigned: bool = False,
    ) -> None:
        self.network = bool(network)
        self.data_read_only = bool(data_read_only)
        self.timeout_ms = int(timeout_ms)
        self.output_limit = int(output_limit)
        self.allow_unsigned = bool(allow_unsigned)

    def check_network(self) -> Dict[str, Any]:
        if not self.network:
            return {"blocked": True, "reason": "network_disabled"}
        return {"blocked": False}

    def check_data_write(self, path: str = "") -> Dict[str, Any]:
        if self.data_read_only:
            return {"blocked": True, "reason": "read_only"}
        return {"blocked": False}
