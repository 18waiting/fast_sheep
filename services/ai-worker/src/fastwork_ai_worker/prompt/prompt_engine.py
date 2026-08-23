"""PromptEngine facade (TASK-019 M4).

Thin deterministic facade over selector/skill-mount/assembler/budgeter
components. It accepts the already-normalized worker request context and never
performs provider or LLM calls.
"""
from __future__ import annotations

from typing import Any, Dict

from .prompt_assembler import assemble


class PromptEngine:
    """Public prompt assembly entry point for the M4 worker package."""

    def prepare(self, request: dict) -> dict:
        """Return the same shape as :func:`prompt_assembler.assemble`.

        Profiles and product-skill mounts may be embedded in the request as
        ``profiles`` and ``product_skills``; when absent, empty collections are
        used so the worker RPC path remains deterministic and offline.
        """
        request = request or {}
        profiles = request.get("profiles") or {}
        product_skills = request.get("product_skills") or {}
        return assemble(request, profiles, product_skills)
