"""Optimization errors (M10, clean-room)."""
from __future__ import annotations


class OptimizationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
