"""Index refresh port (M9, clean-room). Worker-side refresh triggers."""
from __future__ import annotations

from typing import Any, Dict, Optional


class IndexRefreshPort:
    """Boundary to the M3 index refresh. M9 calls it after knowledge mutation."""

    def refresh(self, mode: str) -> Dict[str, Any]:
        raise NotImplementedError

    def mark_rebuild(self) -> Dict[str, Any]:
        raise NotImplementedError


class NoopIndexRefreshPort(IndexRefreshPort):
    def refresh(self, mode: str) -> Dict[str, Any]:
        return {"mode": mode, "ok": True, "deferred": False}

    def mark_rebuild(self) -> Dict[str, Any]:
        return {"deferred": True, "ok": True}


class RecordingIndexRefreshPort(IndexRefreshPort):
    def __init__(self) -> None:
        self.calls: list = []

    def refresh(self, mode: str) -> Dict[str, Any]:
        self.calls.append(("refresh", mode))
        return {"mode": mode, "ok": True, "deferred": False}

    def mark_rebuild(self) -> Dict[str, Any]:
        self.calls.append(("mark_rebuild", None))
        return {"deferred": True, "ok": True}
