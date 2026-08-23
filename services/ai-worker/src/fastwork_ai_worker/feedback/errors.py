"""Feedback errors (M9, clean-room)."""
from __future__ import annotations


class FeedbackError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
