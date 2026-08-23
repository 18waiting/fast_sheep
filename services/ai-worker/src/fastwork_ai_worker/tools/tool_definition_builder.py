"""Build ToolDefinition values from declarative skill dictionaries."""
from __future__ import annotations

from typing import Any, Dict

from .types import ToolDefinition


def from_skill(skill: Dict[str, Any]) -> ToolDefinition:
    """Return a tool definition for a SKILL.md-style skill dict."""
    if not isinstance(skill, dict):
        raise TypeError("skill must be a dict")

    name = skill.get("name") or skill.get("id") or ""
    description = skill.get("description") or ""

    skill_type = skill.get("skill_type") or skill.get("type") or ""
    if skill_type:
        skill_type = str(skill_type).lower()
    else:
        run = skill.get("run") or {}
        if run.get("command"):
            skill_type = "query"
        else:
            skill_type = "instruction"

    body = skill.get("body")
    if body is None:
        body = ""
    elif not isinstance(body, str):
        body = str(body)

    run = skill.get("run")
    if run is not None and not isinstance(run, dict):
        run = None

    signature = skill.get("signature")
    enabled = skill.get("enabled", True)
    if not isinstance(enabled, bool):
        enabled = bool(enabled)

    return ToolDefinition(
        name=name,
        description=description,
        skill_type=skill_type,
        body=body,
        run=run,
        signature=signature,
        enabled=enabled,
    )
