"""EmbeddingProvider abstraction (TASK-018 M3). Interface only — no network."""
from __future__ import annotations

from typing import List, Protocol, runtime_checkable

import numpy as np


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Produces deterministic embeddings. Production adapters are later work."""

    dimension: int

    def embed(self, texts: List[str]) -> List[np.ndarray]:
        """Embed texts; returns a list of float32 vectors of self.dimension."""
        ...
