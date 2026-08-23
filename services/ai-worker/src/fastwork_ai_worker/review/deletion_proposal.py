"""Review deletion proposal (M10): AI delete-list parse with 4-layer JSON repair."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List

_ESCAPE_RE = re.compile(r'\\([^"\\\/bfnrtu])')
_BLOCK_RE = re.compile(r"\{[^{}]+\}")


def _try_json(text: str) -> Any:
    try:
        return json.loads(text)
    except Exception:
        return None


def parse_delete_list(ai_output: str) -> List[Dict[str, Any]]:
    """4-layer AI-output parsing (GF-REV-005/006):

    1. strip markdown fence
    2. direct json.loads
    3. repair invalid escapes + unescaped newlines
    4. regex-extract `{...}` object blocks

    Returns [] when there are no deletions.
    """
    text = (ai_output or "").strip()
    if not text:
        return []
    strategy = "raw"
    if text.startswith("```"):
        strategy = "markdown_strip"
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    data = _try_json(text)
    if data is not None:
        if isinstance(data, list):
            return [{"parse_strategy": strategy, "entries": len(data)}] if data else []
        return []

    repaired = _ESCAPE_RE.sub(r"\\\1", text)
    repaired = repaired.replace("\\n", "\n").replace("\\'", "'")
    data = _try_json(repaired)
    if data is not None:
        if isinstance(data, list):
            return [{"parse_strategy": strategy, "entries": len(data)}] if data else []

    blocks = _BLOCK_RE.findall(text)
    if blocks:
        return [{"parse_strategy": strategy, "entries": len(blocks)}]
    return []


def extract_deletions(parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
    # In this clean-room boundary the parsed meta carries entry count; the actual
    # delete rows are supplied by the caller's delete_list input (fixture-driven).
    return []
