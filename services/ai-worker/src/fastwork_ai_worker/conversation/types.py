"""Internal conversation types (TASK-020 M5)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class TraceEntry:
    sequence: int
    component: str
    operation: str
    decision: Optional[str] = None
    state_before: Optional[str] = None
    state_after: Optional[str] = None
    correlation_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {"sequence": self.sequence, "component": self.component, "operation": self.operation}
        if self.decision is not None:
            out["decision"] = self.decision
        if self.state_before is not None:
            out["state_before"] = self.state_before
        if self.state_after is not None:
            out["state_after"] = self.state_after
        if self.correlation_id is not None:
            out["correlation_id"] = self.correlation_id
        if self.metadata:
            out["metadata"] = self.metadata
        return out
