"""Audit types (M10, clean-room)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


AUDIT_ACTIONS = ("保留", "丢弃", "待定")


@dataclass
class AuditConfig:
    protected_product_id: str = "1"       # empty product -> general library (GF-AUDIT-002)
    review_pending_round: bool = True     # 再审核待定 is a human round, no provider calls


@dataclass
class AuditDecision:
    action: str = ""                     # 保留 | 丢弃 | 待定
    entry: Dict[str, Any] = field(default_factory=dict)
    product_id: str = ""
    knowledge_op: str = "none"           # none | commit
    trust: str = ""
    index_refresh: str = "none"          # none | incremental
    keep_pending: bool = False
    external_calls: int = 0
