"""Work-hours gate (M9, clean-room). Pure + deterministic; injected clock/timezone."""
from __future__ import annotations

import datetime
from typing import Optional


def _parse_hhmm(value: str) -> Optional[int]:
    """Parse HH:MM (or H:MM) into minutes since midnight; None if invalid."""
    try:
        parts = value.strip().split(":")
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        if not (0 <= h <= 23 and 0 <= m <= 59):
            return None
        return h * 60 + m
    except (ValueError, IndexError):
        return None


def minutes_at(epoch_ms: int, tz_offset_minutes: int = 0) -> int:
    """Minutes since local midnight at the given epoch ms (UTC + offset)."""
    secs = epoch_ms // 1000 + tz_offset_minutes * 60
    dt = datetime.datetime.fromtimestamp(secs, tz=datetime.timezone.utc)
    return dt.hour * 60 + dt.minute


def in_work_hours(work_hours: str, epoch_ms: int, tz_offset_minutes: int = 0) -> Optional[bool]:
    """Return True/False when a window is defined; None when the window is empty/invalid.

    Windows are HH:MM-HH:MM with inclusive boundaries and overnight support.
    Empty value => all-day (no gate, caller treats as pass). Invalid value => no gate (None).
    """
    value = work_hours.strip()
    if not value:
        return None
    if "-" not in value:
        return None
    left, _, right = value.partition("-")
    start = _parse_hhmm(left)
    end = _parse_hhmm(right)
    if start is None or end is None:
        return None
    now = minutes_at(epoch_ms, tz_offset_minutes)
    if start <= end:
        return start <= now <= end
    # overnight: e.g. 22:00-06:00
    return now >= start or now <= end
