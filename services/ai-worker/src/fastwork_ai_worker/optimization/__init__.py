"""M10 optimization package (TASK-025): worker PROPOSES only; Main applies product changes."""
from .product_optimization_engine import ProductOptimizationEngine, propose_optimization
from .errors import OptimizationError

__all__ = ["ProductOptimizationEngine", "propose_optimization", "OptimizationError"]
