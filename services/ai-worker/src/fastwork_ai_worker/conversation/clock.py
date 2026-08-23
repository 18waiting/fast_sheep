"""Clock abstraction (TASK-020 M5): injectable; no wall-clock in tests."""
from __future__ import annotations

import time


class Clock:
    def now(self) -> float:
        return time.time()


class FakeClock(Clock):
    """Deterministic virtual clock."""

    def __init__(self, start: float = 0.0):
        self.t = start

    def now(self) -> float:
        return self.t

    def advance(self, ms: float) -> None:
        self.t += ms

    def set(self, ms: float) -> None:
        self.t = ms
