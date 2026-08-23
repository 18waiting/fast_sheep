"""Internal prompt-assembly types (TASK-019 M4).

Only prompt-subsystem-local types live here. Canonical prompt store records and
generation contracts stay in @fastwork/contracts / domain contracts.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class PromptAssemblyResult:
    """Deterministic result returned by PromptEngine.prepare / prompt_assembler.assemble."""

    slots: List[str] = field(default_factory=list)
    order: List[str] = field(default_factory=lambda: ["head", "product", "history", "reference"])
    mounted_skills: List[str] = field(default_factory=list)
    skill_context_included: bool = True
    image_rule: str = ""
    prompt: str = ""
    messages: List[Dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slots": list(self.slots),
            "order": list(self.order),
            "mounted_skills": list(self.mounted_skills),
            "skill_context_included": self.skill_context_included,
            "image_rule": self.image_rule,
            "prompt": self.prompt,
            "messages": [dict(m) for m in self.messages],
        }


@dataclass
class PromptBudgetDecision:
    """Character-budget truncation decision."""

    truncate_order: List[str] = field(default_factory=lambda: ["reference", "history", "product", "head"])
    truncate: List[str] = field(default_factory=list)
    cut: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "truncate_order": list(self.truncate_order),
            "truncate": list(self.truncate),
            "cut": int(self.cut),
        }
