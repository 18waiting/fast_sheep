"""Literal keyword matcher (M9, clean-room). Substring containment, first match wins."""
from __future__ import annotations

from typing import List, Optional
from .rule_parser import split_keywords


def match_keywords(keyword_cell: str, merged_text: str) -> Optional[str]:
    """Return the first keyword (in rule order) contained in merged_text, else None.

    If the cell is a single pseudo-keyword (【...】), it is NOT a literal match here.
    """
    if keyword_cell.strip().startswith("【") and keyword_cell.strip().endswith("】"):
        return None
    for kw in split_keywords(keyword_cell):
        if kw and kw in merged_text:
            return kw
    return None
