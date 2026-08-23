"""Feedback idempotency (M9, clean-room). In-worker bounded applied set; durable
Main-side tracking (feedback_records.effect_status) is the source of truth."""
from __future__ import annotations


class FeedbackIdempotency:
    def __init__(self, max_size: int = 1024):
        self._applied = set()
        self._max_size = max_size

    def was_applied(self, record_id: str) -> bool:
        return record_id in self._applied

    def mark_applied(self, record_id: str) -> None:
        self._applied.add(record_id)
        if len(self._applied) > self._max_size:
            # bounded: drop the oldest element (set order is insertion-ordered in CPython)
            oldest = next(iter(self._applied))
            self._applied.discard(oldest)

    def reset(self) -> None:
        self._applied.clear()
