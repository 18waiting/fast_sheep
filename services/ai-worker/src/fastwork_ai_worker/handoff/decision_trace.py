"""Decision trace (M9, clean-room). Logical, non-sensitive trace entries."""
from __future__ import annotations

from typing import Any, Dict, List
from .types import TraceEntry


def trace_to_dicts(trace: List[TraceEntry]) -> List[Dict[str, Any]]:
    return [{"step": t.step, "detail": t.detail, "matched": t.matched} for t in trace]
