"""Vector math helpers (TASK-018 M3): L2 normalization, cosine/IP, dimension checks.

No retrieval policy here.
"""
from __future__ import annotations

import numpy as np

from .errors import invalid_dimension


def validate_dimension(vector: np.ndarray, expected: int) -> None:
    arr = np.asarray(vector, dtype=np.float32)
    if arr.ndim == 1 and arr.shape[0] != expected:
        raise invalid_dimension(f"expected dimension {expected}, got {arr.shape[0]}")
    if arr.ndim == 2 and arr.shape[1] != expected:
        raise invalid_dimension(f"expected dimension {expected}, got {arr.shape[1]}")


def l2_normalize(vector: np.ndarray) -> np.ndarray:
    """L2-normalize a vector (or row-matrix) to unit norm (float32)."""
    arr = np.asarray(vector, dtype=np.float32)
    if arr.ndim == 1:
        norm = np.linalg.norm(arr)
        if norm == 0.0:
            return arr
        return arr / norm
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0.0] = 1.0
    return arr / norms


def inner_product(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)))


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    """Exact cosine similarity (used by deterministic tests)."""
    va = l2_normalize(a)
    vb = l2_normalize(b)
    return float(np.clip(np.dot(va, vb), -1.0, 1.0))
