"""Prompt/product skill-mount resolution (TASK-019 M4).

Selected prompt profile skills are unioned with product-mounted skills. Profile
mounts come first; product mounts are appended only when not already present,
preserving first-seen order.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


def _as_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    return [str(value)]


def _profile_skills(profile_id: Optional[str], profiles: Dict[str, Any]) -> List[str]:
    if not isinstance(profiles, dict) or profile_id is None:
        return []
    profile = profiles.get(str(profile_id)) or profiles.get(profile_id)
    if not isinstance(profile, dict):
        return []
    return _as_list(profile.get("mounted_skills"))


def _product_skills(product_id: Optional[str], product_skills: Dict[str, Any]) -> List[str]:
    if not isinstance(product_skills, dict) or product_id is None:
        return []
    key = str(product_id)
    skills = product_skills.get(key, product_skills.get(product_id))
    return _as_list(skills)


def resolve_mounted_skills(profile_id, product_id, profiles: dict, product_skills: dict) -> list[str]:
    """Return deduplicated union of profile and product mounted skills."""
    result: List[str] = []
    seen = set()

    def add(skill: str) -> None:
        skill = str(skill)
        if skill and skill not in seen:
            seen.add(skill)
            result.append(skill)

    for skill in _profile_skills(profile_id, profiles):
        add(skill)
    for skill in _product_skills(product_id, product_skills):
        add(skill)
    return result


def resolve_decision(profile_id, product_id, profiles: dict, product_skills: dict) -> dict:
    """Return the golden-fixture decision envelope for skill mounts."""
    return {"mounted_skills": resolve_mounted_skills(profile_id, product_id, profiles, product_skills)}

