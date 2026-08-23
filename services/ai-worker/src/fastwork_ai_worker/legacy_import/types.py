"""Legacy import types (M11, clean-room)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class KnowledgeRow:
    question: str
    answer: str
    product_id: str
    tags: List[str] = field(default_factory=list)
    library: str = "A库"


@dataclass
class KnowledgeImportResult:
    inserted: int = 0
    skipped_duplicates: int = 0
    candidates: int = 0
    trust_map: Dict[str, str] = field(default_factory=dict)
