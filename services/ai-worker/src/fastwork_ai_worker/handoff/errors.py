"""Handoff errors (M9, clean-room)."""
from __future__ import annotations


class HandoffError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
