"""LearningEngine (M10, clean-room). Offline QA lifecycle pipeline, NOT training.

Stages: CONVERSATION_IMPORT -> PRODUCT_EXTRACTION -> CANDIDATE_EXTRACT -> PENDING_WRITE
-> INDEX_SIGNAL. Cancellation checkpoints between batches; partial retention on
provider failure/cancel. Emits LearningProgress events.
"""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from .errors import LearningError
from .product_resolver import resolve_products
from .conversation_qa_extractor import extract_qa, IMAGE_PLACEHOLDERS
from .candidate_deduplicator import dedup_qa
from .candidate_frequency import frequency_groups
from .candidate_refiner import generate_qa
from .commit_policy import commit_policy
from .index_refresh import index_signal


def _byte_len(text: str) -> int:
    """UTF-8 byte length — the source length guard counts bytes (GF-LEARN-006/007)."""
    return len(text.encode("utf-8"))


def _excluded_questions(questions: List[str], min_chars: int) -> List[str]:
    """Frequency-analysis exclusions: too short (byte length) or image placeholders."""
    excluded = []
    for q in questions:
        if _byte_len(q) < min_chars or any(p in q for p in IMAGE_PLACEHOLDERS):
            excluded.append(q)
    return excluded


class LearningEngine:
    def __init__(self, pending_repo: Any = None, candidate_repo: Any = None,
                 embedding_provider: Any = None, generation_provider: Any = None,
                 progress_cb: Optional[Callable[[int, bool], None]] = None,
                 is_cancelled: Optional[Callable[[], bool]] = None):
        self._pending = pending_repo
        self._candidates = candidate_repo
        self._embedding = embedding_provider
        self._generation = generation_provider
        self._progress = progress_cb or (lambda p, c: None)
        self._is_cancelled = is_cancelled or (lambda: False)

    def run(self, request: Dict[str, Any]) -> Dict[str, Any]:
        trace: List[Dict[str, Any]] = []
        config = request.get("config") or {}
        lcfg = config.get("learning") or {}
        min_chars = int(lcfg.get("min_chars", 5))
        batch_id = str(request.get("batch_id") or "b1")
        command = str(request.get("command") or "")

        trace.append({"sequence": 1, "component": "LearningEngine", "operation": "CONVERSATION_IMPORT"})
        if command == "cancel":
            return self._finish(trace, cancelled=True)

        chat = str(request.get("chat") or request.get("import_source") or "")
        products = resolve_products(chat)
        trace.append({"sequence": 2, "component": "LearningEngine", "operation": "PRODUCT_EXTRACTION", "products": products})

        # Coarse QA from normalized chat / provided qa
        qa = [dict(x) for x in (request.get("qa") or [])]
        parsed, excluded = extract_qa(chat, min_chars)
        qa.extend(parsed)
        qa = dedup_qa(qa)
        trace.append({"sequence": 3, "component": "LearningEngine", "operation": "CANDIDATE_EXTRACT", "count": len(qa)})

        # Provider availability probe: a failing generation provider fails the
        # learning job while retaining partial work (GF-LEARN-010).
        provider_failed = False
        if self._generation is not None:
            try:
                probe = self._generation.generate({"prompt": "qa", "segment": ""})
                if probe is not None and probe.get("error"):
                    provider_failed = True
            except Exception:
                provider_failed = True

        # Frequency analysis: filter short/image questions first (GF-LEARN-006/007).
        questions = [str(q) for q in (request.get("questions") or [])]
        frequency: Optional[Dict[str, Any]] = None
        if questions:
            q_excluded = _excluded_questions(questions, min_chars)
            excluded.extend(q_excluded)
            kept = [q for q in questions if q not in q_excluded]
            if kept and self._embedding is not None:
                frequency = frequency_groups(kept, self._embedding, float(lcfg.get("freq_threshold", 0.9)))
                trace.append({"sequence": 3, "component": "LearningEngine", "operation": "FREQUENCY", "result": frequency})

        # Refinement via mock provider for segments
        segment = request.get("segment")
        refined: List[Dict[str, Any]] = []
        if segment and self._generation is not None and not provider_failed:
            try:
                refined = generate_qa(segment, self._generation)
            except Exception:
                provider_failed = True
            if self._candidates is not None:
                for item in refined:
                    self._candidates.insert({
                        "candidate_id": "c-" + batch_id + "-" + str(len(trace)),
                        "source": "learning", "question": item.get("问题", ""), "answer": item.get("答案", ""),
                        "product_id": str(segment.get("商品ID") or ""), "tags": [], "origin": "GENERATED",
                        "status": "PENDING_REVIEW", "frequency": None, "evidence": None,
                    })
            trace.append({"sequence": 4, "component": "LearningEngine", "operation": "CANDIDATE_GENERATED", "count": len(refined)})

        if provider_failed:
            return self._finish(trace, cancelled=False, partial=len(qa) + len(refined), provider_failed=True)

        # Pending write (partial retention on cancel/failure)
        inserted = 0
        if self._pending is not None:
            for item in qa:
                if self._is_cancelled():
                    break
                self._pending.upsert({"id": f"p-{batch_id}-{inserted}", "question": item.get("问题", ""), "answer": item.get("答案", ""),
                                      "product_id": products[0] if products else "", "source": "learning", "origin": "LEARNED",
                                      "batch_id": batch_id, "created_at": "2026-08-16T00:00:00Z"})
                inserted += 1
        trace.append({"sequence": 4, "component": "LearningEngine", "operation": "PENDING_WRITE", "inserted": inserted})

        if self._is_cancelled():
            return self._finish(trace, cancelled=True, partial=inserted)

        policy = commit_policy(lcfg)
        signal = index_signal("append", inserted)
        trace.append({"sequence": 5, "component": "LearningEngine", "operation": "INDEX_SIGNAL", "result": signal})

        if command == "finish":
            trace.append({"sequence": 6, "component": "LearningEngine", "operation": "ARCHIVE", "result": {"rename": "已学习_<ts>.txt"}})
            self._progress(100, True)
            return {"trace": trace, "events": [{"event": "LearningProgress", "payload_subset": {"completed": True}}], "commit_policy": policy, "index_signal": signal}

        self._progress(100, False)
        return {"trace": trace, "events": [{"event": "LearningProgress", "payload_subset": {"progress": 100}}], "commit_policy": policy,
                "index_signal": signal, "products": products, "excluded": excluded, "inserted": inserted,
                "frequency": frequency, "qa": qa}

    def _finish(self, trace: List[Dict[str, Any]], cancelled: bool, partial: int = 0, provider_failed: bool = False) -> Dict[str, Any]:
        state = "CANCELLED" if cancelled else "FAILED"
        # Partial results are retained (never rolled back) on cancel/failure.
        return {"trace": trace, "decisions": {"job_state": state}, "partial_retained": True,
                "job_state": state, "partial": partial, "provider_failed": provider_failed}


def run_learning(request: Dict[str, Any], engine: Optional[LearningEngine] = None) -> Dict[str, Any]:
    eng = engine or LearningEngine()
    return eng.run(request)
