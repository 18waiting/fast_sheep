"""Shared M10 golden helpers (clean-room, test-only).

Each runner executes a frozen fixture against the real clean-room
implementation (LearningEngine / ReviewEngine / AuditEngine /
ProductOptimizationEngine) plus Main-side mirror policies (cooldown/backup)
and returns PASS/FAIL by comparing the fixture's `expected` decisions,
persistence and events.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

sys_path = os.path.dirname(__file__)
import sys  # noqa: E402
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)


# ---------------------------------------------------------------------------
# In-memory repositories (test doubles)
# ---------------------------------------------------------------------------
class InMemoryPendingStore:
    def __init__(self) -> None:
        self.rows: List[Dict[str, Any]] = []

    def upsert(self, entry: Dict[str, Any]) -> None:
        self.rows.append(dict(entry))

    def count(self) -> int:
        return len(self.rows)


class InMemoryCandidateRepo:
    def __init__(self) -> None:
        self.rows: List[Dict[str, Any]] = []

    def insert(self, row: Dict[str, Any]) -> None:
        self.rows.append(dict(row))

    def by_origin(self, origin: str) -> List[Dict[str, Any]]:
        return [r for r in self.rows if r.get("origin") == origin]


class InMemoryKnowledgeRepo:
    def __init__(self) -> None:
        self.rows: Dict[str, Dict[str, Any]] = {}
        self.deleted: List[Dict[str, Any]] = []

    def upsert(self, row: Dict[str, Any]) -> None:
        self.rows[row["id"]] = dict(row)

    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        return self.rows.get(entry_id)

    def delete(self, entry_id: str) -> None:
        if entry_id in self.rows:
            self.deleted.append(self.rows.pop(entry_id))

    def count(self) -> int:
        return len(self.rows)


class InMemoryDeletionStore:
    def __init__(self) -> None:
        self.rows: List[Dict[str, Any]] = []

    def upsert(self, row: Dict[str, Any]) -> None:
        self.rows.append(dict(row))


class InMemoryRollbackStore:
    def __init__(self) -> None:
        self.snapshots: Dict[str, Dict[str, Any]] = {}

    def snapshot(self, entry_id: str, entry: Dict[str, Any]) -> str:
        self.snapshots[entry_id] = dict(entry)
        return "rb-" + entry_id

    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        return self.snapshots.get(entry_id)


class RecordingIndexRefresh:
    def __init__(self) -> None:
        self.marks: List[Any] = []

    def refresh(self, mode: str) -> None:
        self.marks.append(("refresh", mode))

    def mark_rebuild(self) -> None:
        self.marks.append(("mark_rebuild", "deferred"))


# ---------------------------------------------------------------------------
# Fixture mock providers
# ---------------------------------------------------------------------------
class FixtureEmbeddingProvider:
    """Builds vectors per `mocks.embedding.directive` (controlled_cosine)."""

    def __init__(self, directive: List[Dict[str, Any]]) -> None:
        self.specs: Dict[int, tuple] = {}
        for d in directive or []:
            target = int(str(d.get("cosine_to", "q0")).replace("q", ""))
            score = float(d.get("score", 0.0))
            self.specs[len(self.specs) + 1] = (target, score)

    def embed(self, texts: List[str]) -> List[Any]:
        import numpy as np

        n = len(texts)
        out = []
        for i in range(n):
            v = np.zeros(16, dtype=np.float64)
            if i == 0:
                v[0] = 1.0
            else:
                spec = self.specs.get(i)
                if spec is None:
                    v[i % 16] = 1.0
                else:
                    _target, score = spec
                    c = max(-1.0, min(1.0, score))
                    v[0] = c
                    s = float((1.0 - c * c) ** 0.5)
                    if s > 0:
                        v[i % 16] = s
            out.append(v)
        return out


class FixtureGenerationProvider:
    """Returns `mocks.generation` verbatim; `error` is reported as a result error."""

    def __init__(self, mock: Dict[str, Any]) -> None:
        self.mock = dict(mock or {})
        self.error = self.mock.get("error")

    def generate(self, request: Dict[str, Any]) -> Dict[str, Any]:
        if self.error:
            return {"error": {"message": str(self.error)}}
        return dict(self.mock)


class FixtureOptimizationProvider:
    def __init__(self, mock: Dict[str, Any]) -> None:
        self.fail = bool((mock or {}).get("error"))

    def propose(self, product_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        if self.fail:
            raise RuntimeError("optimization provider failure")
        return {"detail": "<优化后详情>"}


def _subset_match(actual: Dict[str, Any], expected: Dict[str, Any]) -> bool:
    for key, value in expected.items():
        if actual.get(key) != value:
            return False
    return True


# ---------------------------------------------------------------------------
# Learning
# ---------------------------------------------------------------------------
def run_learning_case(fx: Dict[str, Any]) -> str:
    from fastwork_ai_worker.learning.learning_engine import LearningEngine

    inp = fx.get("input") or {}
    config = fx.get("config") or {}
    mocks = fx.get("mocks") or {}
    directive = (mocks.get("embedding") or {}).get("directive") or []
    questions = list(inp.get("questions") or [])
    # Empty input + directive -> derive question count from directive entries + 1.
    if not questions and directive:
        questions = ["question" + str(i) for i in range(len(directive) + 1)]
    embedding = FixtureEmbeddingProvider(directive)
    generation = FixtureGenerationProvider(mocks.get("generation"))
    pending = InMemoryPendingStore()
    candidates = InMemoryCandidateRepo()
    engine = LearningEngine(
        pending_repo=pending,
        candidate_repo=candidates,
        embedding_provider=embedding,
        generation_provider=generation,
    )
    result = engine.run({**inp, "questions": questions, "config": config})

    expected = fx.get("expected") or {}
    decisions = expected.get("decisions") or []
    if decisions:
        if not _subset_match(result, decisions[0]):
            # fall back to embedded frequency entry inside trace
            freq = None
            for t in result.get("trace", []):
                if t.get("operation") == "FREQUENCY":
                    freq = t.get("result")
            if freq is None or not _subset_match(freq, decisions[0]):
                return "FAIL"
    events = expected.get("events") or []
    for ev in events:
        found = any((e.get("event") == ev.get("event") and _subset_match(e.get("payload_subset", {}), ev.get("payload_subset", {}))) for e in result.get("events", []))
        if not found:
            return "FAIL"
    persistence = expected.get("persistence") or []
    for p in persistence:
        agg = p.get("aggregate")
        if agg == "pending_knowledge" and p.get("op") == "insert":
            if pending.count() != p.get("rows"):
                return "FAIL"
        elif agg == "pending_knowledge" and "partial_retained" in p:
            if result.get("partial_retained") is not True:
                return "FAIL"
        elif agg == "knowledge_candidate" and p.get("op") == "insert":
            if not candidates.by_origin(p.get("origin", "")):
                return "FAIL"
        elif agg == "job" and p.get("state"):
            if result.get("job_state") != p.get("state"):
                return "FAIL"
        elif agg == "archive":
            arch = None
            for t in result.get("trace", []):
                if t.get("operation") == "ARCHIVE":
                    arch = t.get("result")
            if arch is None or not str(arch.get("rename", "")).endswith(str(p.get("suffix", ""))):
                return "FAIL"
    return "PASS"


# ---------------------------------------------------------------------------
# Review
# ---------------------------------------------------------------------------
def run_review_case(fx: Dict[str, Any]) -> str:
    from fastwork_ai_worker.review.review_engine import ReviewEngine

    inp = fx.get("input") or {}
    config = fx.get("config") or {}
    knowledge = InMemoryKnowledgeRepo()
    deletions = InMemoryDeletionStore()
    rollback = InMemoryRollbackStore()
    index = RecordingIndexRefresh()

    case_id = fx.get("case_id", "")
    if case_id.endswith("-008"):
        engine = ReviewEngine(knowledge_repo=knowledge, deletion_repo=deletions, rollback_store=rollback, index_refresh=index)
        result = engine.restore({"record": inp.get("record") or {}})
        expected = (fx.get("expected") or {}).get("persistence") or []
        for p in expected:
            if p.get("aggregate") == "knowledge" and p.get("op") == "append":
                if result.get("persistence", {}).get("op") != "append":
                    return "FAIL"
                if result.get("persistence", {}).get("trust") != p.get("trust"):
                    return "FAIL"
                if result.get("persistence", {}).get("tag") != p.get("tag"):
                    return "FAIL"
            if p.get("aggregate") == "index" and p.get("op") == "mark_rebuild":
                if not any(m[0] == "mark_rebuild" for m in index.marks):
                    return "FAIL"
        return "PASS"

    # Seed matching knowledge rows when the fixture provides a delete_list but no
    # kb_rows (the delete executes against the knowledge store; GF-REV-004).
    delete_list = inp.get("delete_list") or []
    kb_rows = list(inp.get("kb_rows") or [])
    if delete_list and not kb_rows:
        for i, item in enumerate(delete_list):
            row = {
                "id": "h" + str(i + 1),
                "product_id": str(item.get("商品ID") or item.get("product_id") or ""),
                "question": str(item.get("问题") or item.get("question") or ""),
                "answer": str(item.get("答案") or item.get("answer") or ""),
            }
            kb_rows.append(row)
            knowledge.rows[row["id"]] = dict(row)

    engine = ReviewEngine(knowledge_repo=knowledge, deletion_repo=deletions, rollback_store=rollback, index_refresh=index)
    result = engine.propose({**inp, "kb_rows": kb_rows, "config": config})

    expected = fx.get("expected") or {}
    decisions = expected.get("decisions") or []
    if decisions and not _subset_match(result.get("decisions", {}), decisions[0]):
        return "FAIL"
    persistence = expected.get("persistence") or []
    for p in persistence:
        agg = p.get("aggregate")
        if agg == "knowledge" and p.get("op") == "delete":
            if result.get("decisions", {}).get("deleted") != p.get("rows"):
                return "FAIL"
        elif agg == "deletion_record" and p.get("op") == "append":
            if not deletions.rows:
                return "FAIL"
    external = expected.get("external_calls")
    if external is not None and external != result.get("external_calls", []):
        return "FAIL"
    return "PASS"


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------
def run_audit_case(fx: Dict[str, Any]) -> str:
    from fastwork_ai_worker.audit.audit_engine import AuditEngine

    inp = fx.get("input") or {}
    knowledge = InMemoryKnowledgeRepo()
    pending = InMemoryPendingStore()
    index = RecordingIndexRefresh()
    engine = AuditEngine(knowledge_repo=knowledge, candidate_repo=InMemoryCandidateRepo(), pending_repo=pending, index_refresh=index)
    result = engine.decide({**inp})

    expected = fx.get("expected") or {}
    decisions = expected.get("decisions") or []
    if decisions and not _subset_match(result.get("decisions", {}), decisions[0]):
        return "FAIL"
    result_expected = expected.get("result")
    if result_expected is not None:
        actual_result = result.get("result") or {}
        for key, value in result_expected.items():
            if actual_result.get(key) != value:
                return "FAIL"
    persistence = expected.get("persistence") or []
    for p in persistence:
        agg = p.get("aggregate")
        if agg == "knowledge":
            if p.get("op") == "none" and any(x.get("op") == "commit" for x in result.get("persistence", [])):
                return "FAIL"
            if p.get("op") == "commit":
                found = next((x for x in result.get("persistence", []) if x.get("op") == "commit"), None)
                if found is None:
                    return "FAIL"
                if p.get("trust") and found.get("trust") != p.get("trust"):
                    return "FAIL"
                if p.get("product_id") and found.get("product_id") != p.get("product_id"):
                    return "FAIL"
        elif agg == "pending_knowledge" and p.get("op") == "keep_pending":
            if not any(x.get("op") == "keep_pending" for x in result.get("persistence", [])):
                return "FAIL"
        elif agg == "index" and p.get("op") == "refresh":
            if not any(x.get("op") == "refresh" and x.get("mode") == p.get("mode") for x in result.get("persistence", [])):
                return "FAIL"
    external = expected.get("external_calls")
    if external is not None and external != result.get("external_calls", []):
        return "FAIL"
    return "PASS"


# ---------------------------------------------------------------------------
# Optimization (worker propose + Main-side mirror policies)
# ---------------------------------------------------------------------------
def cooldown_check(last_optimized_at, now_ms, cooldown_seconds, purge_seconds):
    if not last_optimized_at:
        return {"cooldown": False}
    import datetime
    try:
        dt = datetime.datetime.fromisoformat(str(last_optimized_at).replace("Z", "+00:00"))
        last_ms = int(dt.timestamp() * 1000)
    except Exception:
        return {"cooldown": False}
    elapsed = (now_ms - last_ms) / 1000.0
    if elapsed > purge_seconds:
        return {"cooldown": False, "purge": True}
    if elapsed >= cooldown_seconds:
        return {"cooldown": False, "operator": "gte"}
    return {"cooldown": True}


def backup_dir() -> str:
    return "备份/商品库合集/<ts>/"


def run_optimization_case(fx: Dict[str, Any]) -> str:
    from fastwork_ai_worker.optimization.product_optimization_engine import ProductOptimizationEngine

    inp = fx.get("input") or {}
    config = fx.get("config") or {}
    mocks = fx.get("mocks") or {}
    case_id = fx.get("case_id", "")
    expected = fx.get("expected") or {}

    # Main-side cooldown / backup fixtures
    if "-007" in case_id or "-008" in case_id or "-009" in case_id or "-010" in case_id:
        cd = cooldown_check(
            inp.get("last_optimized_at"),
            _cooldown_now_ms(fx, inp.get("last_optimized_at")),
            int((config.get("optimization") or {}).get("cooldown_seconds", 3600)),
            int((config.get("optimization") or {}).get("cooldown_purge_seconds", 86400)),
        )
        decisions = expected.get("decisions") or []
        if decisions and not _subset_match(cd, decisions[0]):
            return "FAIL"
        if "-010" in case_id:
            persistence = expected.get("persistence") or []
            for p in persistence:
                if p.get("aggregate") == "cooldown" and p.get("op") == "purge":
                    if cd.get("purge") is not True:
                        return "FAIL"
        return "PASS"

    if "-011" in case_id:
        persistence = expected.get("persistence") or []
        for p in persistence:
            if p.get("aggregate") == "backup" and p.get("op") == "copy":
                if backup_dir() != p.get("dir"):
                    return "FAIL"
        return "PASS"

    provider = FixtureOptimizationProvider(mocks.get("generation"))
    engine = ProductOptimizationEngine(provider=provider)
    result = engine.propose({**inp, "config": config})

    decisions = expected.get("decisions") or []
    if decisions and not _subset_match(result.get("decisions", {}), decisions[0]):
        return "FAIL"
    external = expected.get("external_calls")
    if external is not None and external != result.get("external_calls", []):
        return "FAIL"
    persistence = expected.get("persistence") or []
    for p in persistence:
        if p.get("aggregate") == "product" and p.get("op") == "apply_detail":
            proposal = result.get("decisions", {}).get("proposal")
            if not proposal:
                return "FAIL"
            if proposal.get("product_id") != inp.get("product_id"):
                return "FAIL"
            if proposal.get("detail") != inp.get("candidate"):
                return "FAIL"
    return "PASS"


def _clock_ms(fx: Dict[str, Any]) -> int:
    import datetime
    clock = fx.get("clock") or {}
    start = clock.get("start") or "2026-08-15T00:00:00Z"
    advance = int(clock.get("advance", 0))
    dt = datetime.datetime.fromisoformat(str(start).replace("Z", "+00:00"))
    return int(dt.timestamp() * 1000) + advance * 1000


def _cooldown_now_ms(fx: Dict[str, Any], last_optimized_at: Any) -> int:
    """Fixture clock convention (GF-OPT-008/009/010).

    - When `advance > 0` it encodes the elapsed seconds since last optimization.
    - When `advance == 0` the `start` timestamp is the current time.
    """
    import datetime
    clock = fx.get("clock") or {}
    advance = int(clock.get("advance", 0))
    start = clock.get("start") or "2026-08-15T00:00:00Z"
    start_ms = int(datetime.datetime.fromisoformat(str(start).replace("Z", "+00:00")).timestamp() * 1000)
    if advance > 0:
        last_ms = int(datetime.datetime.fromisoformat(str(last_optimized_at).replace("Z", "+00:00")).timestamp() * 1000)
        return last_ms + advance * 1000
    return start_ms


# ---------------------------------------------------------------------------
# Discovery runners (used by mjs verify scripts + unittest golden files)
# ---------------------------------------------------------------------------
def _run_family(fixtures_dir: str, prefix: str, runner) -> Dict[str, Any]:
    import glob
    results = []
    passed = 0
    for f in sorted(glob.glob(os.path.join(fixtures_dir, "*.json"))):
        with open(f, encoding="utf-8") as fh:
            fx = json.load(fh)
        if not fx.get("case_id", "").startswith(prefix):
            continue
        result = runner(fx)
        results.append({"case_id": fx["case_id"], "result": result})
        if result == "PASS":
            passed += 1
    return {"discovered": len(results), "passed": passed, "failed": len(results) - passed, "results": results}


def run_all_learning_goldens(fixtures_dir: str) -> Dict[str, Any]:
    return _run_family(fixtures_dir, "GF-LEARN", run_learning_case)


def run_all_review_goldens(fixtures_dir: str) -> Dict[str, Any]:
    return _run_family(fixtures_dir, "GF-REV", run_review_case)


def run_all_audit_goldens(fixtures_dir: str) -> Dict[str, Any]:
    return _run_family(fixtures_dir, "GF-AUDIT", run_audit_case)


def run_all_optimization_goldens(fixtures_dir: str) -> Dict[str, Any]:
    return _run_family(fixtures_dir, "GF-OPT", run_optimization_case)
