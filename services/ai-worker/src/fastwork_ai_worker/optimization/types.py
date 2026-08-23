"""Optimization types (M10, clean-room)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class OptimizationConfig:
    dirty_length_limit: int = 20000
    cooldown_seconds: int = 3600
    cooldown_purge_seconds: int = 86400


@dataclass
class OptimizationProposal:
    product_id: str
    detail: str
    dirty: bool = False
    reason: str = ""
    cooldown: bool = False
