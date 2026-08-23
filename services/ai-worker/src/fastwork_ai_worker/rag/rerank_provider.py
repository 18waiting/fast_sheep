"""RerankProvider abstraction (TASK-018 M3). Interface only — no network."""
from __future__ import annotations

from typing import List, Protocol, runtime_checkable


@runtime_checkable
class RerankProvider(Protocol):
    def rerank(self, query: str, documents: List[str]) -> List[float]:
        """Return relevance scores aligned to documents. Production adapters are later work."""
        ...
