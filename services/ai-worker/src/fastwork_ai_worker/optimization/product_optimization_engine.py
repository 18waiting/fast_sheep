"""ProductOptimizationEngine (M10): guards + cooldown; worker PROPOSES only."""
from __future__ import annotations

import re
from typing import Any, Dict, Optional

from .types import OptimizationConfig, OptimizationProposal
from .optimization_provider import MockOptimizationProvider

HTML_RE = re.compile(r"<[a-zA-Z/][^>]*>")
TAILWIND_RE = re.compile(r"class\s*=\s*[\"'][^\"']*--tw-")


def guard_detail(candidate: str, limit: int) -> Dict[str, Any]:
    if not candidate:
        return {"dirty": True, "reason": "empty"}
    if len(candidate) > limit:
        return {"dirty": True, "reason": "length"}
    if HTML_RE.search(candidate):
        return {"dirty": True, "reason": "html"}
    if TAILWIND_RE.search(candidate):
        return {"dirty": True, "reason": "tailwind"}
    return {"dirty": False}


class ProductOptimizationEngine:
    def __init__(self, provider: Optional[MockOptimizationProvider] = None):
        self._provider = provider or MockOptimizationProvider()

    def propose(self, request: Dict[str, Any]) -> Dict[str, Any]:
        config = request.get("config") or {}
        ocfg = config.get("optimization") or {}
        limit = int(ocfg.get("dirty_length_limit", 20000))
        product_id = str(request.get("product_id") or "")
        has_candidate = "candidate" in request and request.get("candidate") is not None
        candidate = str(request.get("candidate") or "")
        if not has_candidate:
            # provider-driven proposal
            try:
                proposed = self._provider.propose(product_id, {"product_id": product_id})
                candidate = str(proposed.get("detail") or "")
            except Exception:
                return {"decisions": {"job_state": "FAILED"}, "external_calls": []}
        guard = guard_detail(candidate, limit)
        if guard["dirty"]:
            return {"decisions": {"dirty": True, "applied": False, "reason": guard["reason"]}, "external_calls": []}
        return {"decisions": {"dirty": False, "applied": True, "proposal": {"product_id": product_id, "detail": candidate}}}


def propose_optimization(request: Dict[str, Any], engine: Optional[ProductOptimizationEngine] = None) -> Dict[str, Any]:
    eng = engine or ProductOptimizationEngine()
    return eng.propose(request)
