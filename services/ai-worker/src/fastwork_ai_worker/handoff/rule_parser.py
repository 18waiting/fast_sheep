"""Handoff rule parser (M9, clean-room). Splits keyword/target lists and normalizes."""
from __future__ import annotations

from typing import List
from .rule_model import normalize_keyword_separators


def split_keywords(value: str) -> List[str]:
    """Split a keyword cell on ,/& after normalizing ，/＆. Whitespace trimmed; empties dropped."""
    normalized = normalize_keyword_separators(value)
    parts = []
    for part in normalized.replace(",", ",").replace("&", ",").split(","):
        p = part.strip()
        if p:
            parts.append(p)
    return parts


def split_targets(value: str) -> List[str]:
    """Split a transfer_to cell on & (random choice later)."""
    out = []
    for part in value.replace("&", "&").split("&"):
        p = part.strip()
        if p:
            out.append(p)
    return out
