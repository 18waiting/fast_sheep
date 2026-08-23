"""M9 handoff package (TASK-024): full HandoffPolicyEngine.
Decides whether/how to transfer; platform execution remains Main/platform adapter.
"""
from .handoff_engine import HandoffPolicyEngine, evaluate_handoff
from .types import HandoffRule, EvaluationContext, HandoffDecision, TraceEntry
from .errors import HandoffError
from .legacy_marker_codec import decode_legacy_marker, encode_legacy_marker

__all__ = [
    "HandoffPolicyEngine", "evaluate_handoff", "HandoffRule", "EvaluationContext",
    "HandoffDecision", "TraceEntry", "HandoffError", "decode_legacy_marker", "encode_legacy_marker",
]
