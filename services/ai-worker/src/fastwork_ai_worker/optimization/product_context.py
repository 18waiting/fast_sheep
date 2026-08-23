"""Optimization product context (M10): product_id normalization."""
from __future__ import annotations

from typing import Any, Dict, Optional


def normalize_product_id(product_id: str) -> str:
    return str(product_id or "").strip()


def product_context(product_id: str, product_row: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"product_id": normalize_product_id(product_id), "title": (product_row or {}).get("title", ""), "detail": (product_row or {}).get("detail", "")}
