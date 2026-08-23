"""Deterministic logical stage trace (TASK-020 M5)."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .types import TraceEntry


class TraceRecorder:
    def __init__(self, correlation_id: Optional[str] = None):
        self.correlation_id = correlation_id
        self._entries: List[TraceEntry] = []
        self._seq = 0

    def add(self, component: str, operation: str, decision: Optional[str] = None, **meta: Any) -> None:
        self._seq += 1
        self._entries.append(
            TraceEntry(
                sequence=self._seq,
                component=component,
                operation=operation,
                decision=decision,
                correlation_id=self.correlation_id,
                metadata=dict(meta) if meta else {},
            )
        )

    def entries(self) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self._entries]

    def operations(self) -> List[str]:
        return [e.operation for e in self._entries]
