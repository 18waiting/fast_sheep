"""Character-based usage calculator (TASK-019 M4).

The original provider layer bills by characters, not provider token usage:
``cost_units = ceil(total_chars / 1000) * multiplier * rate - base``, with a
non-negative floor.  ``base`` is only applied when the supplied policy provides
it, keeping the no-policy case simple and explicit.
"""
from __future__ import annotations

import math
from typing import Any, Dict, Optional


def calculate(
    input_chars: int,
    output_chars: int,
    multiplier: float = 1.0,
    policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    input_chars = max(0, int(input_chars))
    output_chars = max(0, int(output_chars))
    total_chars = input_chars + output_chars
    multiplier = float(multiplier)
    policy = policy or {}
    rate = float(policy.get("rate", 0.1))
    base = float(policy.get("base", 0.0))

    raw = math.ceil(total_chars / 1000.0) * multiplier * rate - base
    cost_units = max(0.0, round(raw, 1))
    return {
        "input_chars": input_chars,
        "output_chars": output_chars,
        "multiplier": multiplier,
        "cost_units": cost_units,
    }