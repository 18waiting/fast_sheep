"""Duplicate-cache (TASK-020 M5): deterministic TTL behavior (GF-CONV-002/014)."""
from __future__ import annotations

from typing import Any, Dict, Optional

from .clock import Clock, FakeClock


class DuplicateCache:
    """Cache key -> (reply, inserted_at_ms). TTL default 60000ms (REBUILD DECISION, configurable)."""

    def __init__(self, clock: Optional[Clock] = None, ttl_ms: int = 60000):
        self.clock = clock or FakeClock()
        self.ttl_ms = ttl_ms
        self._store: Dict[str, Dict[str, Any]] = {}

    def check(self, key: str) -> Dict[str, Any]:
        now = self.clock.now()
        entry = self._store.get(key)
        if entry is None:
            return {"hit": False, "reply": None, "expired": False}
        if now - entry["at"] > self.ttl_ms:
            self._store.pop(key, None)
            return {"hit": False, "reply": None, "expired": True}
        return {"hit": True, "reply": entry["reply"], "expired": False}

    def put(self, key: str, reply: str) -> None:
        self._store[key] = {"reply": reply, "at": self.clock.now()}
