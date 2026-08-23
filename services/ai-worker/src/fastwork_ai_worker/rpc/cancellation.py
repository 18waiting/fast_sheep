"""Active request/task cancellation registry for the M2 worker."""
from __future__ import annotations

import asyncio
from typing import Dict, Optional


class CancellationRegistry:
    """Tracks active request tasks by request_id and cancels them cooperatively."""

    def __init__(self) -> None:
        self._tasks: Dict[str, asyncio.Task] = {}

    def register(self, request_id: str, task: asyncio.Task) -> bool:
        """Register a task. Returns False if the request_id is already active (duplicate)."""
        if request_id in self._tasks:
            return False
        self._tasks[request_id] = task
        return True

    def remove(self, request_id: str) -> None:
        self._tasks.pop(request_id, None)

    def cancel(self, request_id: str) -> bool:
        """Cancel the task for request_id. Returns True if a task was found."""
        task = self._tasks.get(request_id)
        if task is None:
            return False
        task.cancel()
        return True

    def active_ids(self) -> list:
        return list(self._tasks.keys())

    def cancel_all(self) -> int:
        """Cancel every active task (used on shutdown). Returns the count."""
        ids = list(self._tasks.keys())
        for rid in ids:
            task = self._tasks.get(rid)
            if task is not None:
                task.cancel()
        return len(ids)
