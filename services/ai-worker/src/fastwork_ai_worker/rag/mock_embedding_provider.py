"""Deterministic MockEmbeddingProvider (TASK-018 M3).

Directives compatible with the TASK-014 test-harness design:
- basis(index): unit basis vector e_index (default dimension 1024)
- explicit fixture mapping: text -> vector spec
- failure injection: error="provider_unavailable"
No hardcoded huge vector fixtures; vectors are generated procedurally.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Union

import numpy as np

from .errors import embedding_failed


class MockEmbeddingProvider:
    def __init__(
        self,
        dimension: int = 1024,
        mapping: Optional[Dict[str, Dict[str, Union[int, float, str]]]] = None,
        error: Optional[str] = None,
        call_log: Optional[list] = None,
    ):
        self.dimension = dimension
        self._mapping = dict(mapping or {})
        self._error = error
        self.call_log = call_log if call_log is not None else []

    def set_error(self, error: Optional[str]) -> None:
        self._error = error

    def basis(self, index: int) -> np.ndarray:
        v = np.zeros(self.dimension, dtype=np.float32)
        v[index % self.dimension] = 1.0
        return v

    def cosine_vector(self, cosine_value: float, basis_index: int) -> np.ndarray:
        """A unit vector with cos(e0, v) = cosine_value (for basis_index != 0)."""
        c = float(np.clip(cosine_value, -1.0, 1.0))
        s = float(np.sqrt(max(0.0, 1.0 - c * c)))
        v = np.zeros(self.dimension, dtype=np.float32)
        v[0] = c
        if basis_index != 0 and s > 0:
            v[basis_index % self.dimension] = s
        return v

    def embed(self, texts: List[str]) -> List[np.ndarray]:
        self.call_log.append(("embed", list(texts)))
        if self._error is not None:
            raise embedding_failed(self._error)
        out: List[np.ndarray] = []
        for text in texts:
            spec = self._mapping.get(text)
            if spec is None:
                out.append(self._hash_vector(text))
                continue
            kind = spec.get("type", "basis")
            if kind == "basis":
                out.append(self.basis(int(spec.get("index", 0))))
            elif kind == "cosine":
                out.append(self.cosine_vector(float(spec.get("cosine", 0.0)), int(spec.get("basis", 1))))
            else:
                raise embedding_failed(f"unknown embedding directive: {kind!r}")
        return out

    def embed_one(self, text: str) -> np.ndarray:
        return self.embed([text])[0]

    def _hash_vector(self, text: str) -> np.ndarray:
        """Deterministic procedural vector for arbitrary texts (no hardcoded fixtures).

        Seeded by the text hash so identical texts embed identically and the
        mapping is stable across processes. L2-normalized.
        """
        import hashlib

        seed = int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:8], "little")
        rng = np.random.default_rng(seed)
        v = rng.standard_normal(self.dimension).astype(np.float32)
        norm = float(np.linalg.norm(v))
        if norm == 0.0:
            return v
        return v / norm
