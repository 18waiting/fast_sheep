"""Feedback types (M9, clean-room)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class FeedbackApplyRequest:
    record_id: str
    conversation_id: str = ""
    class_name: str = "AUTO"          # AUTO|MANUAL|NO_SAVE|CORRECTION|AUDIT_APPROVE|RESTORE
    trust_level: str = ""
    question: str = ""
    answer: str = ""
    product_id: str = ""
    entry: Dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    retry: bool = False


@dataclass
class KnowledgeEffect:
    op: str                    # none|append|insert
    trust: str = ""
    entry_id: Optional[str] = None
    index_refresh: str = "none"   # none|incremental|deferred


@dataclass
class FeedbackApplyResult:
    record_id: str
    ok: bool
    knowledge_op: str = "none"
    entry_id: Optional[str] = None
    index_refresh: str = "none"
    applied: bool = False
    error: Optional[str] = None
