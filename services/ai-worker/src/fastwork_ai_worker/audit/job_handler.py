"""Audit job handler (M10): wraps audit decide in a job body."""
from __future__ import annotations

from typing import Any, Dict, Optional

from .audit_engine import AuditEngine


def handle_job(request: Dict[str, Any], engine: Optional[AuditEngine] = None) -> Dict[str, Any]:
    eng = engine or AuditEngine()
    return eng.decide(request)
