"""Deterministic MockRerankProvider (TASK-018 M3).

Maps candidate index/id to a relevance score; supports success, timeout/error
injection, and call recording (used by NO_CALL / CALL_SEQUENCE golden checks).
"""
from __future__ import annotations

from typing import Dict, List, Optional

from .errors import rerank_failed


class MockRerankProvider:
    def __init__(
        self,
        scores: Optional[Dict[int, float]] = None,
        error: Optional[str] = None,
        call_log: Optional[list] = None,
        delay_s: float = 0.0,
    ):
        self._scores = dict(scores or {})
        self._error = error
        self.call_log = call_log if call_log is not None else []
        self._delay_s = delay_s

    def set_error(self, error: Optional[str]) -> None:
        self._error = error

    def rerank(self, query: str, documents: List[str]) -> List[float]:
        self.call_log.append(("rerank", query, list(documents)))
        if self._delay_s > 0:
            import time

            time.sleep(self._delay_s)
        if self._error is not None:
            raise rerank_failed(self._error)
        out: List[float] = []
        for i in range(len(documents)):
            out.append(float(self._scores.get(i, 0.5)))
        return out
