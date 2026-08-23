"""Welcome policy (TASK-020 M5): synthetic welcome text; no marketing prose (GF-CONV-003)."""
from __future__ import annotations

from typing import Any, Dict, Optional


class WelcomePolicy:
    def __init__(self, enabled: bool = False, text: str = "亲,欢迎光临~"):
        self.enabled = enabled
        self.text = text

    def decide(self, is_first_in_period: bool = False) -> Dict[str, Any]:
        if self.enabled and is_first_in_period:
            return {"early_return": True, "reply": self.text}
        return {"early_return": False, "reply": None}
