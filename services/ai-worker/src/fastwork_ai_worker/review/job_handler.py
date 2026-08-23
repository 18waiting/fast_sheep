"""Review job handler (M10): wraps review propose/apply/restore in job bodies."""
from __future__ import annotations

from typing import Any, Dict, Optional

from .review_engine import ReviewEngine


def handle_job(request: Dict[str, Any], engine: Optional[ReviewEngine] = None) -> Dict[str, Any]:
    eng = engine or ReviewEngine()
    op = str(request.get("op") or "propose")
    if op == "apply":
        return eng.apply(request)
    if op == "restore":
        return eng.restore(request)
    return eng.propose(request)
