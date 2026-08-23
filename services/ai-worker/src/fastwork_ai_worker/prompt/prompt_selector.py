"""Order-state prompt selection (TASK-019 M4).

Clean-room parity with spec/ai/prompt-assembly.md section 3/4:
- ``未下单`` (default) and ``已下单`` map to prompt profile ids from
  ``config["prompts"]``.
- Unknown order states fall back to ``未下单``.
"""
from __future__ import annotations

from typing import Any, Dict

ORDER_NOT_ORDERED = "未下单"
ORDER_ORDERED = "已下单"

_KEY_NOT_ORDERED = "未下单ID"
_KEY_ORDERED = "已下单ID"


def _prompt_mapping(config: Dict[str, Any]) -> Dict[str, str]:
    if not isinstance(config, dict):
        return {}
    prompts = config.get("prompts")
    if not isinstance(prompts, dict):
        return {}
    return {
        ORDER_NOT_ORDERED: "" if prompts.get(_KEY_NOT_ORDERED) is None else str(prompts.get(_KEY_NOT_ORDERED, "")),
        ORDER_ORDERED: "" if prompts.get(_KEY_ORDERED) is None else str(prompts.get(_KEY_ORDERED, "")),
    }


def select_profile(order_state: str, config: dict) -> str:
    """Return the selected prompt profile id for ``order_state``.

    The public API intentionally keeps this logic free of database or file IO;
    the caller supplies the already-normalized ``config`` mapping.
    """
    mapping = _prompt_mapping(config)
    state = order_state if order_state in (ORDER_NOT_ORDERED, ORDER_ORDERED) else ORDER_NOT_ORDERED
    return mapping.get(state, "")


def select_profile_decision(order_state: str, config: dict) -> list:
    """Return the golden-fixture decision envelope for prompt selection."""
    return [{"profile": select_profile(order_state, config)}]

