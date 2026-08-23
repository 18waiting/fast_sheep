"""Learning types (M10, clean-room)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class LearningConfig:
    freq_threshold: float = 0.9
    top_n: int = 100
    min_chars: int = 5
    qa_cap: int = 2000


@dataclass
class LearningProgressEvent:
    progress: int = 0
    completed: bool = False
