"""Prompt assembly (TASK-019 M4).

Deterministic, offline assembly of the four-slot prompt shape. This module
does not call providers and does not contain proprietary FastWork prompt prose.
"""
from __future__ import annotations

from typing import Any, Dict, List

from .prompt_selector import select_profile
from .skill_mount_resolver import resolve_mounted_skills

SLOT_ORDER: List[str] = ["head", "product", "history", "reference"]

PLACEHOLDER_PROMPT = "\n".join(
    [
        "<PROMPT_CONTENT>",
        "<PRODUCT_INFO>",
        "<HISTORY>",
        "<REFERENCE>",
    ]
)


def _bool_flag(request: Dict[str, Any], key: str) -> bool:
    value = request.get(key, False)
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "y", "on")
    return bool(value)


def _non_empty(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _profile_id_from_request(request: Dict[str, Any]) -> str:
    profile_id = request.get("profile_id")
    if profile_id not in (None, ""):
        return str(profile_id)
    order_state = request.get("order_state", "未下单")
    config = request.get("config")
    if isinstance(config, dict):
        selected = select_profile(order_state, config)
        if selected:
            return selected
    return str(profile_id or "")


def _image_rule(request: Dict[str, Any]) -> str:
    message_has_image = _bool_flag(request, "message_has_image")
    product_has_image = _bool_flag(request, "product_has_image")
    if message_has_image or product_has_image:
        return "preserve_img_tag"
    return ""


def assemble(request: dict, profiles: dict, product_skills: dict) -> dict:
    """Assemble the prompt and return its public golden-fixture shape."""
    request = request or {}
    profiles = profiles or {}
    product_skills = product_skills or {}

    profile_id = _profile_id_from_request(request)
    product_id = request.get("product_id")

    mounted_skills = resolve_mounted_skills(profile_id or None, product_id, profiles, product_skills)
    skill_context_included = not _bool_flag(request, "skip_skill_context")
    image_rule = _image_rule(request)

    head_text = request.get("head", request.get("prompt_content", profile_id or request.get("order_state", "")))
    product_text = request.get("product_info", "")
    history_text = request.get("history", "")
    reference_text = request.get("reference_content", "")

    head_present = _non_empty(head_text) or bool(profile_id) or _non_empty(request.get("order_state"))
    product_present = _non_empty(product_text) or _bool_flag(request, "has_product")
    history_present = _non_empty(history_text) or _bool_flag(request, "has_history")
    reference_present = _non_empty(reference_text) or _bool_flag(request, "has_reference")

    presence = {
        "head": head_present,
        "product": product_present,
        "history": history_present,
        "reference": reference_present,
    }
    slots = [slot for slot in SLOT_ORDER if presence[slot]]

    prompt = PLACEHOLDER_PROMPT
    query = request.get("query", request.get("question", ""))
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": query if query is not None else ""},
    ]

    return {
        "slots": slots,
        "order": list(SLOT_ORDER),
        "mounted_skills": mounted_skills,
        "skill_context_included": skill_context_included,
        "image_rule": image_rule,
        "prompt": prompt,
        "messages": messages,
    }

