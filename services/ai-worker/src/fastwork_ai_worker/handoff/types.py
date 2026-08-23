"""Handoff types (M9, clean-room). Rule model + evaluation context + decision."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class HandoffRule:
    keyword: str
    transfer_to: str = ""
    transfer_message: str = ""
    work_hours: str = ""
    source_agent: str = ""
    status: str = "生效"
    order_state: str = ""
    applicable_shops: str = ""
    sort_order: int = 0
    enabled: bool = True

    def is_pseudo_keyword(self) -> bool:
        return self.keyword.strip().startswith("【") and self.keyword.strip().endswith("】")


@dataclass
class EvaluationContext:
    question: str = ""
    ai_reply: str = ""
    agent: str = ""
    shop: str = ""
    order_state: str = ""
    highest_sim: float = 0.0
    time_ms: int = 0
    platform: str = ""          # canonical platform id when known
    enabled: bool = True        # master M1 gate (转接判断模式)
    capabilities: Dict[str, Any] = field(default_factory=dict)

    @property
    def merged_text(self) -> str:
        return (self.question + " " + self.ai_reply).strip()


@dataclass
class TraceEntry:
    step: str
    detail: str = ""
    matched: bool = False


@dataclass
class HandoffDecision:
    transfer: bool = False
    target: Optional[str] = None
    keyword: Optional[str] = None
    reason: Optional[str] = None
    operator: Optional[str] = None
    transfer_message: Optional[str] = None
    trace: List[TraceEntry] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {"transfer": self.transfer}
        if self.target is not None:
            out["target"] = self.target
        if self.keyword is not None:
            out["keyword"] = self.keyword
        if self.reason is not None:
            out["reason"] = self.reason
        if self.operator is not None:
            out["operator"] = self.operator
        if self.transfer_message is not None:
            out["transfer_message"] = self.transfer_message
        return out
