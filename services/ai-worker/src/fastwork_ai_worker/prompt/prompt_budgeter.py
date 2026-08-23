"""Character-budget truncation decision (TASK-019 M4).

Priority order is fixed: reference -> history -> product -> head. The fixture
harness supplies content sizes and the configured per-slot sizes as ints. This
module does not fetch or mutate any content; it only returns the decision.
"""
from __future__ import annotations

from typing import Any, Dict, List

PRIORITY_ORDER: List[str] = ["reference", "history", "product", "head"]


def _size(value: Any) -> int:
    """Return the character size of a content slot.

    Accepts either a concrete string (``len``) or an already-computed numeric
    length. Missing/non-numeric values contribute zero.
    """
    if isinstance(value, str):
        return len(value)
    if isinstance(value, bool):
        return 0
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def budget_decide(contents: dict, budget: dict, question_len: int = 300) -> dict:
    """Return the deterministic truncation decision.

    ``contents`` is keyed by ``reference``, ``history``, ``product`` and
    ``head``. Values may be actual strings or their computed lengths.
    ``budget`` contains ``total_chars`` and the per-slot configured sizes
    (reference_chars, history_chars, product_chars, head_chars).
    """
    contents = contents or {}
    budget = budget or {}
    total_chars = _size(budget.get("total_chars"))
    lengths = {slot: _size(contents.get(slot)) for slot in PRIORITY_ORDER}

    overage = sum(lengths.values()) + _size(question_len) - total_chars
    if overage <= 0:
        return {
            "truncate_order": list(PRIORITY_ORDER),
            "truncate": [],
            "cut": 0,
        }

    remaining = overage
    truncate: List[str] = []
    total_cut = 0

    for index, slot in enumerate(PRIORITY_ORDER):
        length = lengths[slot]
        cut = min(length, remaining)
        truncate.append(slot)
        total_cut += cut
        remaining -= cut

        if length > cut:
            # This slot still has content after consuming all remaining overage.
            break

        # Slot is fully cut (length == cut).
        if remaining <= 0:
            # Record the next slot as the zero-cut boundary, matching the
            # fixture expectation for reference-only / reference+history cuts.
            if index + 1 < len(PRIORITY_ORDER):
                truncate.append(PRIORITY_ORDER[index + 1])
            break
        # Else continue to the next priority slot.

    return {
        "truncate_order": list(PRIORITY_ORDER),
        "truncate": truncate,
        "cut": total_cut,
    }
