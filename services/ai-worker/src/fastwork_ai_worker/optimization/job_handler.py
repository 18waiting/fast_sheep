"""Optimization job handler (M10): wraps proposal in a cancellable job body."""
from __future__ import annotations

from typing import Any, Dict, Optional

from .product_optimization_engine import ProductOptimizationEngine, propose_optimization


def handle_job(request: Dict[str, Any], engine: Optional[ProductOptimizationEngine] = None) -> Dict[str, Any]:
    return propose_optimization(request, engine)
