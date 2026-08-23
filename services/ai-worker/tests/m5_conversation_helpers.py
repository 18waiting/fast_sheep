"""M5 conversation golden harness (TASK-020): executes all GF-CONV fixtures through the
real ConversationEngine with deterministic test doubles. No production behavior here.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List


def _num_close(a: Any, b: Any, tol: float) -> bool:
    try:
        return abs(float(a) - float(b)) <= tol
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


def compare(expected: Any, actual: Any) -> bool:
    """Subset-on-expected-keys comparison (dicts/lists)."""
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(expected) != len(actual):
            return False
        return all(compare(ev, av) for ev, av in zip(expected, actual))
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return False
        for k, ev in expected.items():
            if k not in actual:
                return False
            if not compare(ev, actual[k]):
                return False
        return True
    return _val_eq(expected, actual)


def _trace_entries(trace: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{"sequence": t.get("sequence"), "component": t.get("component"), "operation": t.get("operation")} for t in trace]


def _decisions_subsequence(expected: List[Dict[str, Any]], actual: List[Dict[str, Any]]) -> bool:
    """Ordered subsequence: each expected decision matches a later actual decision (per-entry subset)."""
    i = 0
    for exp in expected:
        found = False
        while i < len(actual):
            if compare(exp, actual[i]):
                found = True
                i += 1
                break
            i += 1
        if not found:
            return False
    return True


def _trace_subsequence(expected: List[Dict[str, Any]], actual: List[Dict[str, Any]]) -> bool:
    """Ordered subsequence: each expected entry matches a later actual entry (component+operation)."""
    i = 0
    for entry in expected:
        found = False
        while i < len(actual):
            if actual[i]["component"] == entry.get("component") and actual[i]["operation"] == entry.get("operation"):
                found = True
                i += 1
                break
            i += 1
        if not found:
            return False
    return True


def run_all_conversation_goldens(fixtures_dir: str) -> Dict[str, Any]:
    from fastwork_ai_worker.conversation.conversation_engine import ConversationEngine
    from fastwork_ai_worker.conversation.duplicate_cache import DuplicateCache
    from fastwork_ai_worker.conversation.test_doubles import (
        FakeAgentLoop,
        FakeClock,
        FakeGenerationProvider,
        FakeHandoffDecisionPort,
        FakePromptEngine,
        FakeRAGEngine,
        FakeRouter,
        MockQuestionCompletionPort,
    )
    from fastwork_ai_worker.conversation.welcome_policy import WelcomePolicy
    from fastwork_ai_worker.conversation.order_context import OrderContextProvider
    from fastwork_ai_worker.conversation.post_processor import PostProcessor

    results = []
    discovered = 0
    passed = 0
    failed = 0
    failed_ids = []
    deferred = []
    for p in sorted(Path(fixtures_dir).glob("GF-CONV-*.json")):
        fx = json.loads(p.read_text(encoding="utf-8"))
        case = fx.get("case_id", "")
        discovered += 1
        status, note = _run_one(
            fx,
            ConversationEngine,
            DuplicateCache,
            FakeClock,
            FakeRAGEngine,
            FakeGenerationProvider,
            FakePromptEngine,
            FakeRouter,
            FakeAgentLoop,
            FakeHandoffDecisionPort,
            MockQuestionCompletionPort,
            WelcomePolicy,
            OrderContextProvider,
            PostProcessor,
        )
        if status == "PASS":
            passed += 1
        elif status == "DEFERRED":
            deferred.append(case)
        else:
            failed += 1
            failed_ids.append(case)
        results.append({"case_id": case, "result": status, "notes": note})
    return {
        "discovered": discovered,
        "passed": passed,
        "failed": failed,
        "deferred": deferred,
        "failed_ids": failed_ids,
        "results": results,
    }


def _run_one(fx, ConversationEngine, DuplicateCache, FakeClock, FakeRAGEngine, FakeGenerationProvider,
             FakePromptEngine, FakeRouter, FakeAgentLoop, FakeHandoffDecisionPort, MockQuestionCompletionPort,
             WelcomePolicy, OrderContextProvider, PostProcessor):
    case = fx.get("case_id", "")
    mocks = fx.get("mocks", {})
    config = fx.get("config", {})
    initial = fx.get("initial_state", {})
    try:
        clock = FakeClock()
        rag_cfg = config.get("rag") or {}

        # deterministic RAG
        retrieval = mocks.get("retrieval", {})
        if "top_sim" in retrieval:
            rag = FakeRAGEngine(top_sim=float(retrieval["top_sim"]), hits=[{"question": "q", "answer": "a", "raw_similarity": float(retrieval["top_sim"])}])
        elif "product_hits" in retrieval or "global_hits" in retrieval:
            hits = list(retrieval.get("product_hits") or []) + list(retrieval.get("global_hits") or [])
            rag = FakeRAGEngine(hits=hits)
        elif mocks.get("embedding", {}).get("error"):
            rag = FakeRAGEngine(error="rag.embedding_failed")
        else:
            rag = FakeRAGEngine(top_sim=0.5, hits=[{"question": "q", "answer": "a", "raw_similarity": 0.5}])

        # deterministic generation
        gen_mock = mocks.get("generation", {})
        if gen_mock.get("error"):
            provider = FakeGenerationProvider(error=gen_mock["error"])
        else:
            scenario = {}
            if gen_mock.get("text") is not None:
                scenario["text"] = gen_mock["text"]
            if gen_mock.get("tool_calls") is not None:
                scenario["tool_calls"] = gen_mock["tool_calls"]
            provider = FakeGenerationProvider(scenarios=[scenario] if scenario else None)

        handoff_mock = mocks.get("handoff", {}).get("decision")
        engine = ConversationEngine(
            rag_engine=rag,
            prompt_engine=FakePromptEngine(),
            provider_router=FakeRouter(),
            generation_provider=provider,
            agent_loop=FakeAgentLoop(text=gen_mock.get("text", "")),
            duplicate_cache=DuplicateCache(clock=clock, ttl_ms=int(config.get("dup_cache_ttl_ms", 60000))),
            order_context=OrderContextProvider(),
            welcome=WelcomePolicy(enabled=bool(config.get("welcome_enabled", False)), text=str(config.get("welcome_text", "亲,欢迎光临~"))),
            question_completion=MockQuestionCompletionPort(completed_question=initial.get("completed_question")),
            handoff_port=FakeHandoffDecisionPort(decision=handoff_mock),
            post_processor=PostProcessor(),
            clock=clock,
        )

        # dup cache hit
        dup_mock = mocks.get("dup_cache", {})
        if dup_mock.get("hit"):
            engine.duplicate_cache.put("q:" + str(initial.get("question", "")), dup_mock.get("cached_reply", "cached"))

        if case == "GF-CONV-014":
            engine.duplicate_cache.put("q:" + str(initial.get("question", "这个多少钱")), "old")
            clock.advance(int(config.get("dup_cache_ttl_ms", 60000)) + 1)
        request = {
            "config": config,
            "long_answer_wrap": bool(config.get("long_answer_wrap", False)),
            "question": initial.get("question") or "测试",
            "order_state": initial.get("order_state") or fx.get("input", {}).get("order_state"),
            "product_id": initial.get("product_id"),
            "chat_history": initial.get("chat_history"),
            "completed_question": initial.get("completed_question"),
            "is_first_in_period": bool(initial.get("is_first_in_period")),
            "history_contains_reply": bool(initial.get("history_contains_reply")),
            "completed_sim": float(mocks.get("retrieval", {}).get("completed_sim", 0.0)) if mocks.get("retrieval") else 0.0,
            "rag_config": rag_cfg,
            "correlation_id": case,
        }
        result = engine.generate(request)
        ok, note = _assert_fixture(fx, result, provider)
        return ("PASS" if ok else "FAIL"), note
    except Exception as e:  # noqa: BLE001
        return "FAIL", type(e).__name__ + ": " + str(e)


def _assert_fixture(fx, result, provider):
    exp = fx.get("expected", {})
    mode = fx.get("comparison", {}).get("mode", "EXACT")
    checks = []
    if "result" in exp:
        checks.append(("result", compare(exp["result"], {k: v for k, v in result.items() if k != "trace" and k != "events"})))
    if "decisions" in exp:
        actual_decisions = []
        for d in result.get("trace", []):
            if d.get("decision"):
                entry = {"stage": d.get("operation"), "decision": d.get("decision")}
                meta = d.get("metadata") or {}
                if meta:
                    entry.update(meta)
                actual_decisions.append(entry)
        checks.append(("decisions", _decisions_subsequence(exp["decisions"], actual_decisions)))
    if "trace" in exp:
        expected_trace = _trace_entries(exp["trace"])
        actual_trace = _trace_entries(result.get("trace", []))
        checks.append(("trace", _trace_subsequence(expected_trace, actual_trace)))
    if "external_calls" in exp:
        ext = exp["external_calls"]
        gen_calls = provider.call_count
        if ext == []:
            checks.append(("no_call", gen_calls == 0))
        else:
            expected_generation = sum(1 for c in ext if c.get("mock") == "generation")
            checks.append(("calls", gen_calls >= expected_generation))
    failed = [name for name, ok in checks if not ok]
    if failed:
        return False, "failed: " + ",".join(failed) + " result=" + json.dumps(result, ensure_ascii=False, default=str)[:200]
    return True, "ok"
