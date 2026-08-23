"""Contract discovery and validation utilities (M0).

Clean-room implementation. Derived only from public/project behavioral
specifications and frozen contracts. The worker must never couple to the
reverse-engineering project root; contracts are discovered from an injected
path (env FASTWORK_CONTRACTS_DIR) or a packaged bundle path (set by the
packager in later milestones).
"""
from __future__ import annotations

import os
from pathlib import Path

from .validator import build_registry, load_schema, validate_contract

CONTRACTS_ENV = "FASTWORK_CONTRACTS_DIR"

__all__ = ["CONTRACTS_ENV", "contracts_dir", "load_schema", "build_registry", "validate_contract"]


def contracts_dir() -> Path | None:
    """Return the JSON Schema contracts root, or None if not configured."""
    env = os.environ.get(CONTRACTS_ENV)
    if env:
        p = Path(env)
        if p.is_dir():
            return p
    return None
