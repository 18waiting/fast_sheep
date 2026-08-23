"""Review types (M10, clean-room)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class ReviewConfig:
    source_whitelist: List[str] = None  # type: ignore
    min_qa_count: int = 0
