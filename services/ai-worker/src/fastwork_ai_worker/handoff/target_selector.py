"""Target selector (M9, clean-room). Deterministic via injectable RNG; &-split random choice."""
from __future__ import annotations

import random
from typing import List, Optional
from .rule_parser import split_targets


class RandomProvider:
    def __init__(self, rng: Optional[random.Random] = None):
        self._rng = rng

    def choice(self, items: List[str]) -> str:
        if self._rng is not None:
            return self._rng.choice(items)
        return random.choice(items)


def select_target(transfer_to: str, rng: Optional[RandomProvider] = None) -> Optional[str]:
    """Split transfer_to on & and choose one deterministically (injectable RNG)."""
    targets = split_targets(transfer_to)
    if not targets:
        return None
    if len(targets) == 1:
        return targets[0]
    provider = rng or RandomProvider()
    return provider.choice(targets)
