"""Compatibility shim: canonical apply lives in review_apply.py."""
from .review_apply import triple_match, apply_delete  # noqa: F401
