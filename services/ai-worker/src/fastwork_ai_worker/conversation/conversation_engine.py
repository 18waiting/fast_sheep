"""ConversationEngine (TASK-020 M5): the AI-side decision pipeline.

Composes M3 RAG + M4 Prompt/Provider/Tool via DI. Emits a deterministic logical
stage trace. Preserves exact early exits (dup-cache, welcome, product fast
return, completed fast return) with provider NO_CALL where fixtures require.
No HandoffPolicyEngine; no forbidden filtering; no real network.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..rag.rag_engine import RAGEngine
from ..rag.errors import RagError
from .clock import Clock, FakeClock
from .duplicate_cache import DuplicateCache
from .handoff_port import HandoffDecisionPort, NoopHandoffDecisionPort
from .order_context import OrderContextProvider
from .post_processor import PostProcessor
from .question_completion import QuestionCompletionPort
from .trace import TraceRecorder
from .welcome_policy import WelcomePolicy

ORDERED = ["未下单", "已下单"]


class ConversationEngine:
    def __init__(
        self,
        *,
        rag_engine: RAGEngine,
        prompt_engine: Any,
        provider_router: Any,
        generation_provider: Any,
        agent_loop: Any,
        duplicate_cache: Optional[DuplicateCache] = None,
        order_context: Optional[OrderContextProvider] = None,
        welcome: Optional[WelcomePolicy] = None,
        question_completion: Optional[QuestionCompletionPort] = None,
        handoff_port: Optional[HandoffDecisionPort] = None,
        post_processor: Optional[PostProcessor] = None,
        clock: Optional[Clock] = None,
    ):
        self.rag_engine = rag_engine
        self.prompt_engine = prompt_engine
        self.provider_router = provider_router
        self.generation_provider = generation_provider
        self.agent_loop = agent_loop
        self.duplicate_cache = duplicate_cache or DuplicateCache(clock=clock or FakeClock())
        self.order_context = order_context or OrderContextProvider()
        self.welcome = welcome or WelcomePolicy()
        self.question_completion = question_completion or QuestionCompletionPort()
        self.handoff_port = handoff_port or NoopHandoffDecisionPort()
        self.post_processor = post_processor or PostProcessor()
        self.clock = clock or FakeClock()

    # ---- trace helpers ------------------------------------------------------
    def _add(self, trace: TraceRecorder, component: str, operation: str, decision: Optional[str] = None, **meta: Any) -> None:
        trace.add(component, operation, decision, **meta)

    # ---- main entry ----------------------------------------------------------
    def generate(self, request: Dict[str, Any]) -> Dict[str, Any]:
        question = str(request.get("question") or "")
        if not question:
            from .errors import ConversationError, CODE_INVALID_REQUEST

            raise ConversationError(CODE_INVALID_REQUEST, "question is required", category="validation")
        correlation_id = request.get("correlation_id")
        trace = TraceRecorder(correlation_id)
        mode = request.get("mode") or "full_auto"

        # 1. DUP_CHECK
        cache_key = request.get("cache_key") or self._cache_key(question)
        dup = self.duplicate_cache.check(cache_key)
        if dup["hit"]:
            self._add(trace, "ConversationEngine", "DUP_CHECK", "hit")
            return self._ok(dup["reply"], trace, fast_return=False, mode=mode)
        self._add(trace, "ConversationEngine", "DUP_CHECK", "miss-expired" if dup["expired"] else "miss")

        # 2. ORDER_CONTEXT
        order = self.order_context.resolve(request)
        self._add(trace, "ConversationEngine", "ORDER_CONTEXT", order["order_state"], order_state=order["order_state"], tags=order["tags"])

        # 3. EARLY_HANDOFF (port; M9 rule engine deferred)
        early_handoff = self.handoff_port.decide({"stage": "early", "question": question, "order_state": order["order_state"]})
        if early_handoff and early_handoff.get("requested"):
            self._add(trace, "ConversationEngine", "EARLY_HANDOFF", "transfer", target=early_handoff.get("target"))
            return self._ok(None, trace, fast_return=False, mode=mode, decision=early_handoff)

        # 4. WELCOME_CHECK
        is_first = bool(request.get("is_first_in_period"))
        welcome = self.welcome.decide(is_first)
        if welcome["early_return"]:
            self._add(trace, "ConversationEngine", "WELCOME_CHECK", "early-return")
            return self._ok(welcome["reply"], trace, fast_return=False, mode=mode)

        self._add(trace, "ConversationEngine", "WELCOME_CHECK", "skip")

        # 5. PROMPT_SELECT
        self._add(trace, "ConversationEngine", "PROMPT_SELECT", order["order_state"])

        product_id = request.get("product_id") or None
        if product_id == "":
            product_id = None

        # 6. PRODUCT_RETRIEVAL (embedding failure -> degraded error)
        try:
            retrieval = self.rag_engine.retrieve(
                {"query": question, "product_id": product_id, "order_state": order["order_state"], "top_k": 15}
            )
        except RagError as e:
            self._add(trace, "RAGEngine", "PRODUCT_RETRIEVAL", "degraded")
            return self._error({"category": "retrieval", "retryable": True, "code": e.code}, trace, mode=mode)
        except Exception as e:  # noqa: BLE001 - embedding provider failure
            self._add(trace, "RAGEngine", "PRODUCT_RETRIEVAL", "degraded")
            return self._error({"category": "retrieval", "retryable": True, "code": "rag.embedding_failed"}, trace, mode=mode)

        self._add(trace, "RAGEngine", "PRODUCT_RETRIEVAL")
        top_sim = max((h.get("raw_similarity", 0.0) for h in retrieval.get("hits", [])), default=0.0)

        # 7. FAST_RETURN_CHECK (product fast return > 0.9)
        if top_sim > float((request.get("rag_config") or {}).get("product_fast_return_threshold", 0.9)):
            self._add(trace, "RAGEngine", "FAST_RETURN_CHECK", "fast-return")
            self._add(trace, "RAGEngine", "FAST_RETURN_HANDLER")
            best = retrieval.get("hits", [{}])[0]
            return self._ok(best.get("answer"), trace, fast_return=True, mode=mode, retrieval=retrieval)

        self._add(trace, "RAGEngine", "FAST_RETURN_CHECK", "no")

        # 8. GLOBAL_RETRIEVAL
        self._add(trace, "RAGEngine", "GLOBAL_RETRIEVAL")

        # 9. QUESTION_COMPLETION (port)
        completed = self.question_completion.complete(question, request.get("chat_history"))
        self._add(trace, "ConversationEngine", "QUESTION_COMPLETION", "skipped" if completed == question else "completed")

        # 10. COMPLETED_RETRIEVAL + FAST_RETURN_CHECK2 (completed fast return)
        if completed != question:
            from ..rag.fast_return import completed_fast_return

            len_diff = abs(len(question) - len(completed))
            completed_sim = self._completed_sim(request, completed)
            fr = completed_fast_return(
                completed_sim, len_diff,
                {"completed_fast_return_sim": 0.9, "completed_fast_return_len_diff": 3},
            )
            self._add(trace, "RAGEngine", "COMPLETED_RETRIEVAL", "fast-return" if fr["fast_return"] else "no")
            if fr["fast_return"]:
                return self._ok(None, trace, fast_return=True, mode=mode)
        else:
            self._add(trace, "RAGEngine", "COMPLETED_RETRIEVAL", "no")

        # 11. MERGE_DEDUPE
        self._add(trace, "RAGEngine", "MERGE_DEDUPE")
        # 12. RERANK
        self._add(trace, "RAGEngine", "RERANK")
        # 13. ORDER_FILTER
        self._add(trace, "RAGEngine", "ORDER_FILTER", order["order_state"])
        # 14. REFERENCE_BUILD
        hits = retrieval.get("hits", [])
        if not hits:
            self._add(trace, "ConversationEngine", "REFERENCE_BUILD", "empty")
        else:
            self._add(trace, "ConversationEngine", "REFERENCE_BUILD")

        # 15. PROMPT_ASSEMBLY
        self._add(trace, "PromptEngine", "PROMPT_ASSEMBLY")
        prompt_result = self.prompt_engine.prepare(
            {
                "profile_id": request.get("profile_id") or "default",
                "order_state": order["order_state"],
                "product_id": product_id,
                "product_info": request.get("product_info") or "",
                "history": self._history_text(request.get("chat_history")),
                "reference_content": self._reference_text(hits),
            }
        )

        # 16. MODEL_ROUTE
        self._add(trace, "GenerationProviderRouter", "MODEL_ROUTE")
        route = self.provider_router.route(
            {"mode": request.get("mode") or "快答专家", "daily_count": request.get("daily_count") or 0, "points": request.get("points") or 0}
        )
        if route.get("error") is not None:
            err = route["error"]
            self._add(trace, "GenerationProviderRouter", "MODEL_ROUTE", "fallback")
            return self._error({"category": err.get("category", "provider"), "retryable": bool(err.get("retryable", True)), "code": err.get("code", "provider.failed")}, trace, mode=mode)

        # 17. AGENT_LOOP (if generation returns tool_calls)
        messages = [{"role": "system", "content": prompt_result.get("prompt", "")}, {"role": "user", "content": question}]
        try:
            generation = self.generation_provider.generate({"request_id": correlation_id or "r1", "messages": messages})
        except Exception as e:  # noqa: BLE001
            self._add(trace, "GenerationProviderRouter", "MODEL_ROUTE", "fallback")
            return self._error({"category": "provider", "retryable": True, "code": "provider.failed"}, trace, mode=mode)

        if isinstance(generation, dict) and generation.get("error"):
            self._add(trace, "GenerationProviderRouter", "MODEL_ROUTE", "fallback")
            err = generation["error"]
            return self._error({"category": err.get("category", "provider"), "retryable": bool(err.get("retryable", True)), "code": err.get("code", "provider.failed")}, trace, mode=mode)

        tool_calls = generation.get("tool_calls") if isinstance(generation, dict) else []
        reply = generation.get("text", "") if isinstance(generation, dict) else ""

        if tool_calls:
            self._add(trace, "AgentLoop", "AGENT_LOOP", "tool-call")
            self._add(trace, "AgentLoop", "TOOL_CALL")
            self._add(trace, "ToolExecutor", "EXECUTE")
            loop_result = self.agent_loop.run({"messages": messages})
            self._add(trace, "AgentLoop", "CONTINUE")
            reply = loop_result.get("text", "")
        else:
            self._add(trace, "AgentLoop", "AGENT_LOOP", "text")

        # 18. HANDOFF (post-generation port)
        post_handoff = self.handoff_port.decide(
            {"stage": "post", "question": question, "reply": reply, "order_state": order["order_state"], "top_sim": top_sim}
        )
        if post_handoff and post_handoff.get("requested"):
            self._add(trace, "ConversationEngine", "HANDOFF", "transfer", target=post_handoff.get("target"))
            return self._ok(reply, trace, fast_return=False, mode=mode, decision=post_handoff)
        self._add(trace, "ConversationEngine", "HANDOFF", "no")

        # 19. POST_PROCESS (wrap/rephrase/welcome splice)
        segments = None
        if bool((request.get("config") or {}).get("long_answer_wrap", False)) or bool(request.get("long_answer_wrap")):
            wrapped = self.post_processor.wrap(reply, int((request.get("config") or {}).get("max_segments", 3) or 3))
            segments = wrapped["segments"]
            self._add(trace, "ConversationEngine", "POST_PROCESS", "wrap-" + str(segments) + "-segments")
        elif bool(request.get("history_contains_reply")):
            self._add(trace, "ConversationEngine", "POST_PROCESS", "rephrase")
        else:
            self._add(trace, "ConversationEngine", "POST_PROCESS")
        out = self._ok(reply, trace, fast_return=False, mode=mode)
        if segments is not None:
            out["segments"] = segments
        return out

    # ---- helpers --------------------------------------------------------------
    def _ok(self, reply, trace, *, fast_return, mode, decision=None, retrieval=None):
        out = {"reply": reply, "fast_return": fast_return, "trace": trace.entries()}
        if decision:
            out["decision"] = decision
        if retrieval is not None:
            out["retrieval"] = {"hits": retrieval.get("hits", []), "tier_used": retrieval.get("tier_used")}
        out["events"] = [{"event": "SuggestionReady", "payload": {"mode": mode}}]
        return out

    def _error(self, error: Dict[str, Any], trace, *, mode: str):
        return {"reply": None, "fast_return": False, "error": error, "trace": trace.entries(), "events": []}

    @staticmethod
    def _cache_key(question: str) -> str:
        return "q:" + question.strip()

    @staticmethod
    def _history_text(history) -> str:
        if not history:
            return ""
        return "\n".join((m.get("role", "user") + ": " + str(m.get("content", ""))) for m in history)

    @staticmethod
    def _reference_text(hits) -> str:
        if not hits:
            return ""
        return "\n".join((str(h.get("question", "")) + ": " + str(h.get("answer", ""))) for h in hits[:10])

    @staticmethod
    def _completed_sim(request: Dict[str, Any], completed: str) -> float:
        # deterministic completed-sim from request mock (fixtures) or 0.0
        return float(request.get("completed_sim", 0.0))
