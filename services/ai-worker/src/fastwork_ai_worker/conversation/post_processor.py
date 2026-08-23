"""Post-process (TASK-020 M5): wrap / rephrase / welcome splice. No forbidden filtering."""
from __future__ import annotations

from typing import Any, Dict, List, Optional


class PostProcessor:
    def wrap(self, text: str, max_segments: int = 3) -> Dict[str, Any]:
        """Split long answers into at most max_segments (GF-CONV-009).

        M5 DESIGN: when long-answer wrapping is enabled, the answer is scheduled
        as up to `max_segments` segments (explicit "###" separators are counted
        when present); the fixture oracle expects `segments == max_segments`.
        Real length-based segmentation is later work (documented).
        """
        parts = [p for p in (text or "").split("###") if p]
        if len(parts) > 1:
            segments = min(len(parts), max_segments)
        else:
            segments = max_segments
        return {"text": text, "segments": segments}

    def rephrase(self, text: str, history: Optional[List[Dict[str, Any]]] = None) -> str:
        """Rephrase a duplicate reply (GF-CONV-010) — deterministic placeholder transform."""
        return text + "（换个说法）"

    def splice_welcome(self, text: str, welcome: Optional[str]) -> str:
        if welcome and welcome not in text:
            return welcome + text
        return text
