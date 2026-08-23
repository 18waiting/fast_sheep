"""Legacy import verifier (M11, clean-room). Worker-side verification of imported
knowledge/candidate counts; RAG readiness is verified by the M3 index_status.
"""
from __future__ import annotations

from typing import Any, Dict


def verify_counts(knowledge_count: int, candidate_count: int, expected_knowledge: int = 0, expected_candidates: int = 0) -> Dict[str, Any]:
    checks = {
        "knowledge_count_ok": knowledge_count >= expected_knowledge,
        "candidate_count_ok": candidate_count >= expected_candidates,
    }
    return {"all_ok": all(checks.values()), "checks": checks, "counts": {"knowledge": knowledge_count, "candidates": candidate_count}}
