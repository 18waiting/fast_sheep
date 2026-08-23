"""Optimization provider (M10): mock proposal provider; injectable failure."""
from __future__ import annotations

from typing import Any, Dict, List, Optional


class MockOptimizationProvider:
    def __init__(self, proposals: Optional[List[Dict[str, Any]]] = None, fail: bool = False):
        self._proposals = proposals or []
        self._fail = fail
        self.calls = 0

    def propose(self, product_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        self.calls += 1
        if self._fail:
            raise RuntimeError("optimization provider failure")
        if self._proposals:
            return dict(self._proposals[0])
        return {"detail": "<优化后详情>"}
