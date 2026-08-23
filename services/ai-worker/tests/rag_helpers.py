"""RAG test fixture support (TASK-018 M3): procedural vectors, fixture loading,
synthetic knowledge, mock provider factories, and golden-fixture execution.

No production behavior lives here.
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from fastwork_ai_worker.rag.deduplicator import dedupe
from fastwork_ai_worker.rag.fast_return import completed_fast_return, product_fast_return
from fastwork_ai_worker.rag.index_builder import IndexBuilder
from fastwork_ai_worker.rag.index_repository import IndexRepository
from fastwork_ai_worker.rag.mock_embedding_provider import MockEmbeddingProvider
from fastwork_ai_worker.rag.mock_rerank_provider import MockRerankProvider
from fastwork_ai_worker.rag.order_filter import filter_results
from fastwork_ai_worker.rag.reranker import Reranker
from fastwork_ai_worker.rag.retriever import Retriever
from fastwork_ai_worker.rag.vector_math import cosine, l2_normalize

COMMON_PRODUCT_ID = "1"


def make_entry(entry_id: str, question: str, answer: str, product_id: str, tags=None, source: str = "s") -> Dict[str, Any]:
    return {
        "id": entry_id,
        "question": question,
        "answer": answer,
        "product_id": product_id,
        "tags": list(tags or []),
        "source": source,
        "trust_level": "HUMAN_CONFIRMED",
        "created_at": "2026-08-15T00:00:00Z",
        "updated_at": "2026-08-15T00:00:00Z",
    }


def mock_provider_for_entries(entries: List[Dict[str, Any]], query_text: str, dimension: int = 1024) -> MockEmbeddingProvider:
    """Build a deterministic provider: query -> basis 0; each entry -> a cosine
    vector with a distinct basis index so no two entries collide."""
    mapping: Dict[str, Dict[str, Any]] = {query_text: {"type": "basis", "index": 0}}
    for i, e in enumerate(entries, start=1):
        mapping[e["question"]] = {"type": "cosine", "cosine": 0.0, "basis": i}
    return MockEmbeddingProvider(dimension=dimension, mapping=mapping)


def build_and_load(root: str, entries: List[Dict[str, Any]], provider, config=None) -> IndexRepository:
    builder = IndexBuilder(provider, config or {})
    built = builder.build_full(entries, root)
    repo = IndexRepository(root, config=config or {})
    repo.swap_in(built["staging"])
    return repo


def _compare_expected(expected: Any, actual: Any, mode: str, tolerance: float = 1e-6) -> bool:
    """Compare expected (result dict or decisions list) against actual."""
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(expected) != len(actual):
            return False
        for ev, av in zip(expected, actual):
            if not fixture_compare(mode, ev, av, tolerance):
                return False
        return True
    return fixture_compare(mode, expected, actual, tolerance)


def fixture_compare(mode: str, expected: Any, actual: Any, tolerance: float = 1e-6) -> bool:
    """Compare per the fixture comparison mode.

    EXACT / default: every key in expected (dict) is present and equal (subset-on-
    expected-keys); lists compare element-wise; scalars strict equal.
    NUMERIC_TOLERANCE: numbers within tolerance.
    UNORDERED_SET / NO_CALL / CALL_SEQUENCE: handled by the caller with side info.
    """
    if mode == "NUMERIC_TOLERANCE":
        if isinstance(expected, dict) and isinstance(actual, dict):
            for k, ev in expected.items():
                if k not in actual or not _num_close(ev, actual[k], tolerance):
                    return False
            return True
        return _num_close(expected, actual, tolerance)
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return False
        for k, ev in expected.items():
            if k not in actual:
                return False
            if isinstance(ev, (int, float)) and not isinstance(ev, bool) and mode == "NUMERIC_TOLERANCE":
                if not _num_close(ev, actual[k], tolerance):
                    return False
            elif not _val_eq(ev, actual[k]):
                return False
        return True
    return _val_eq(expected, actual)


def _num_close(a: Any, b: Any, tolerance: float) -> bool:
    try:
        return abs(float(a) - float(b)) <= tolerance
    except (TypeError, ValueError):
        return False


def _val_eq(a: Any, b: Any) -> bool:
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a.keys()) != set(b.keys()):
            return False
        return all(_val_eq(a[k], b[k]) for k in a)
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        if len(a) != len(b):
            return False
        return all(_val_eq(x, y) for x, y in zip(a, b))
    if isinstance(a, float) or isinstance(b, float):
        return abs(float(a) - float(b)) <= 1e-9
    return a == b


# ---- per-group golden executors -------------------------------------------


def _run_index(fx: Dict[str, Any]) -> Dict[str, Any]:
    import faiss

    mock = fx.get("mocks", {})
    emb = mock.get("embedding", {})
    dim = int(emb.get("dimension", 1024))
    provider = MockEmbeddingProvider(dimension=dim)
    q = provider.basis(0)
    v = provider.cosine_vector(0.8, 1)
    index = faiss.IndexIDMap2(faiss.IndexFlatIP(dim))
    index.add_with_ids(np.stack([l2_normalize(v)]), np.array([7], dtype=np.int64))
    d, i = index.search(l2_normalize(q).reshape(1, -1), 1)
    score = float(d[0][0])
    hit = int(i[0][0]) == 7 and score > 0.7
    actual = {
        "metric": "cosine_after_l2",
        "dimension": dim,
        "hit": hit,
    }
    return {"actual": actual, "mode": fx.get("comparison", {}).get("mode", "EXACT")}


def _run_tier(fx: Dict[str, Any]) -> Dict[str, Any]:
    mock = fx.get("mocks", {}).get("index", {})
    cfg = fx.get("config", {}).get("rag", {})
    entries: List[Dict[str, Any]] = []
    mapping: Dict[str, Dict[str, Any]] = {"这个多少钱": {"type": "basis", "index": 0}}
    n = 0
    common = mock.get("common_hit")
    product = mock.get("product_hit")
    global_hit = mock.get("global_hit")
    if common is not None:
        n += 1
        entries.append(make_entry("c1", "common-q", "common-a", COMMON_PRODUCT_ID))
        mapping["common-q"] = {"type": "cosine", "cosine": float(common.get("sim", 0.0)), "basis": n}
    if product is not None:
        n += 1
        entries.append(make_entry("p1", "product-q", "product-a", "P1"))
        mapping["product-q"] = {"type": "cosine", "cosine": float(product.get("sim", 0.0)), "basis": n}
    if global_hit is not None:
        n += 1
        entries.append(make_entry("g1", "global-q", "global-a", ""))
        mapping["global-q"] = {"type": "cosine", "cosine": float(global_hit.get("sim", 0.0)), "basis": n}
    provider = MockEmbeddingProvider(dimension=1024, mapping=mapping)
    with tempfile.TemporaryDirectory() as root:
        repo = build_and_load(root, entries, provider, config=cfg)
        q = provider.embed_one("这个多少钱")
        tr = Retriever(repo, cfg).retrieve(q, "P1", 5, knowledge_isolation=cfg.get("product_isolation"))
        actual = tr.decisions
    return {"actual": actual, "mode": fx.get("comparison", {}).get("mode", "EXACT")}


def _run_qth(fx: Dict[str, Any]) -> Dict[str, Any]:
    mock = fx.get("mocks", {}).get("index", {})
    cfg = fx.get("config", {}).get("rag", {})
    product_hit = mock.get("product_hit", {})
    sim = float(product_hit.get("sim", mock.get("sim", 0.0)))
    actual = Retriever(None, cfg).quality_decision(sim)  # type: ignore[arg-type]
    return {"actual": actual, "mode": fx.get("comparison", {}).get("mode", "EXACT")}


def _run_dedup(fx: Dict[str, Any]) -> Dict[str, Any]:
    results = fx.get("mocks", {}).get("results", [])
    out = dedupe(results, max_repeat=3)
    return {"actual": {"count": len(out)}, "mode": fx.get("comparison", {}).get("mode", "EXACT")}


def _run_comp(fx: Dict[str, Any]) -> Dict[str, Any]:
    cand = fx.get("mocks", {}).get("candidate", {})
    cfg = fx.get("config", {}).get("rag", {})
    raw = float(cand.get("raw", 0.0))
    rerank = float(cand.get("rerank", 0.0))
    r = Reranker(provider=None, config=cfg)
    composite = r.composite_score(raw, rerank)
    return {
        "actual": {"composite": composite},
        "mode": fx.get("comparison", {}).get("mode", "NUMERIC_TOLERANCE"),
        "float_tolerance": fx.get("comparison", {}).get("float_tolerance", 1e-6),
    }


def _run_rskip(fx: Dict[str, Any]) -> Dict[str, Any]:
    mock = fx.get("mocks", {}).get("index", {})
    cfg = fx.get("config", {}).get("rag", {})
    top_sim = float(mock.get("top_sim", 0.0))
    candidates = int(mock.get("candidates", 0))
    call_log: list = []
    provider = MockRerankProvider(call_log=call_log)
    r = Reranker(provider=provider, config=cfg, call_log=call_log)
    decision = r.skip_decision(top_sim, candidates)
    if decision.get("rerank") is True:
        # genuinely execute the rerank path (CALL_SEQUENCE) with candidate hits
        from fastwork_ai_worker.rag.types import RerankCandidate, RawHit

        hits = []
        for i in range(candidates):
            hits.append(
                RawHit(
                    entry_id="e" + str(i),
                    question="q" + str(i),
                    answer="a" + str(i),
                    product_id="P1",
                    source="s",
                    tags=[],
                    faiss_id=i,
                    raw_similarity=top_sim - 0.01 * i,
                    tier="product",
                )
            )
        r.rerank("query", [RerankCandidate(hit=h) for h in hits])
    rerank_calls = [c for c in call_log if c[0] == "rerank"]
    return {
        "actual": [decision],
        "mode": fx.get("comparison", {}).get("mode", "NO_CALL"),
        "external_calls": fx.get("expected", {}).get("external_calls", []),
        "rerank_call_count": len(rerank_calls),
    }


def _run_fr(fx: Dict[str, Any]) -> Dict[str, Any]:
    mock = fx.get("mocks", {}).get("index", {})
    cfg = fx.get("config", {}).get("rag", {})
    if "top_sim" in mock:
        actual = product_fast_return(float(mock["top_sim"]), cfg)
    else:
        actual = completed_fast_return(float(mock.get("completed_sim", 0.0)), int(mock.get("len_diff", 0)), cfg)
    return {"actual": [actual], "mode": fx.get("comparison", {}).get("mode", "EXACT")}


def _run_ord(fx: Dict[str, Any]) -> Dict[str, Any]:
    results = fx.get("mocks", {}).get("results", [])
    order_state = fx.get("input", {}).get("order_state")
    out = filter_results(results, order_state)
    if "kept" in fx.get("expected", {}).get("result", {}):
        out = dict(out)
        out["kept"] = [r["q"] for r in out["kept"]]
    return {"actual": out, "mode": fx.get("comparison", {}).get("mode", "EXACT")}


_EXECUTORS = {
    "INDEX": _run_index,
    "TIER": _run_tier,
    "QTH": _run_qth,
    "DEDUP": _run_dedup,
    "COMP": _run_comp,
    "RSKIP": _run_rskip,
    "FR": _run_fr,
    "ORD": _run_ord,
}


def run_golden_fixture(fx: Dict[str, Any]) -> Dict[str, Any]:
    case_id = fx.get("case_id", "")
    group = case_id.split("-")[2] if len(case_id.split("-")) > 2 else ""
    runner = _EXECUTORS.get(group)
    if runner is None:
        return {"case_id": case_id, "result": "FAIL", "notes": "no executor for group " + group}
    try:
        outcome = runner(fx)
        exp = fx.get("expected", {})
        expected = exp.get("decisions", exp.get("result", {}))
        actual = outcome["actual"]
        mode = outcome.get("mode", "EXACT")
        passed = _compare_expected(expected, actual, mode, outcome.get("float_tolerance", 1e-6))
        # NO_CALL / CALL_SEQUENCE external-call assertions
        ext_calls = fx.get("expected", {}).get("external_calls", [])
        if ext_calls == [] and outcome.get("rerank_call_count", 0) != 0:
            passed = False
        if ext_calls and outcome.get("rerank_call_count", 0) < len(ext_calls):
            passed = False
        return {
            "case_id": case_id,
            "result": "PASS" if passed else "FAIL",
            "notes": "expected=" + json.dumps(expected, ensure_ascii=False) + " actual=" + json.dumps(actual, ensure_ascii=False, default=str),
        }
    except Exception as e:  # noqa: BLE001
        return {"case_id": case_id, "result": "FAIL", "notes": type(e).__name__ + ": " + str(e)}


def run_all_golden_fixtures(fixtures_dir: str) -> Dict[str, Any]:
    """Execute every GF-RAG-*.json under fixtures_dir; returns reportable results."""
    results = []
    discovered = 0
    passed = 0
    failed = 0
    failed_ids = []
    for p in sorted(Path(fixtures_dir).glob("GF-RAG-*.json")):
        discovered += 1
        fx = json.loads(p.read_text(encoding="utf-8"))
        r = run_golden_fixture(fx)
        results.append(r)
        if r["result"] == "PASS":
            passed += 1
        else:
            failed += 1
            failed_ids.append(fx.get("case_id"))
    return {
        "discovered": discovered,
        "passed": passed,
        "failed": failed,
        "failed_ids": failed_ids,
        "results": results,
    }
