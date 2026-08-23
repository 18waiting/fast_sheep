"""Compatibility shim: canonical selector lives in review_selector.py."""
from .review_selector import filter_whitelist, dedup_against_b, cold_start_protected  # noqa: F401
