"""Learning job handler (M10): cancellable learning job body."""
from __future__ import annotations

from typing import Any, Dict, Optional

from .learning_engine import LearningEngine


def handle_job(request: Dict[str, Any], engine: Optional[LearningEngine] = None) -> Dict[str, Any]:
    eng = engine or LearningEngine()
    return eng.run(request)
