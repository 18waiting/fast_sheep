"""ReviewEngine (M10): selector -> proposal -> apply -> rollback/restore."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .errors import ReviewError
from .review_selector import filter_whitelist, dedup_against_b, cold_start_protected
from .deletion_proposal import parse_delete_list
from .review_apply import apply_delete


class ReviewEngine:
    def __init__(self, knowledge_repo: Any = None, deletion_repo: Any = None,
                 rollback_store: Any = None, index_refresh: Any = None):
        self._knowledge = knowledge_repo
        self._deletions = deletion_repo
        self._rollback = rollback_store
        self._index = index_refresh

    def propose(self, request: Dict[str, Any]) -> Dict[str, Any]:
        config = request.get("config") or {}
        rcfg = config.get("review") or {}
        whitelist = rcfg.get("source_whitelist") or []
        candidates = [dict(x) for x in (request.get("candidates") or [])]
        b_library = [dict(x) for x in (request.get("b_library") or [])]
        kb = str(request.get("kb") or "")

        # Cold-start protection applies only when no explicit review policy is
        # configured (GF-REV-003); a configured whitelist takes precedence (GF-REV-001).
        if not whitelist and cold_start_protected(candidates, b_library, request.get("sop")):
            return {"decisions": {"skip": "cold_start_protection"}}

        kept = filter_whitelist(candidates, whitelist)
        if whitelist:
            kept_sources = sorted({str(c.get("来源") or c.get("source") or "") for c in kept})
            return {"decisions": {"kept": kept_sources}, "kept": kept}

        if len(dedup_against_b(kept, b_library)) != len(kept):
            return {"decisions": {"deduped": True}, "kept": dedup_against_b(kept, b_library)}

        ai_output = str(request.get("ai_output") or "")
        if ai_output:
            parsed = parse_delete_list(ai_output)
            if not parsed:
                return {"decisions": {"deletions": 0}, "external_calls": []}
            return {"decisions": {"parse_strategy": parsed[0]["parse_strategy"], "entries": parsed[0]["entries"]}, "external_calls": []}

        delete_list = [dict(x) for x in (request.get("delete_list") or [])]
        if not delete_list:
            return {"decisions": {"deletions": 0}, "external_calls": []}

        protected_kbs = rcfg.get("protected_kbs") or []
        protected = kb in protected_kbs or "B库" in kb or "人工确认" in kb
        result = apply_delete(delete_list, [dict(x) for x in (request.get("kb_rows") or [])], protected)
        if self._knowledge is not None and not protected:
            for r in result.get("rows", []):
                try:
                    self._knowledge.delete(r.get("id") or ("fe-" + str(r.get("product_id", ""))[:12] + str(r.get("question", ""))[:12]))
                except Exception:
                    pass
        if self._deletions is not None and not protected:
            for item in delete_list:
                self._deletions.upsert({"id": "dl-" + str(item.get("商品ID") or item.get("product_id") or ""), "product_id": str(item.get("商品ID") or item.get("product_id") or ""), "question": str(item.get("问题") or item.get("question") or ""), "answer": str(item.get("答案") or item.get("answer") or ""), "reason": str(item.get("删除理由") or ""), "created_at": "2026-08-16T00:00:00Z"})
        return {"decisions": {"deleted": result.get("deleted", 0), "protected": result.get("protected", False)}, "result": result, "external_calls": []}

    def restore(self, request: Dict[str, Any]) -> Dict[str, Any]:
        from .review_restore import restore_entry
        record = request.get("record") or {}
        entry = dict(record)
        outcome = restore_entry(self._knowledge, entry, self._rollback)
        if outcome.get("applied") and self._index is not None:
            self._index.mark_rebuild()
        return {"decisions": outcome, "persistence": {"aggregate": "knowledge", "op": "append", "trust": "AUTO", "tag": "审查恢复"} if outcome.get("applied") else {"aggregate": "knowledge", "op": "none"}}

    def apply(self, request: Dict[str, Any]) -> Dict[str, Any]:
        return self.propose({**request, "delete_list": request.get("delete_list") or []})


def run_review(request: Dict[str, Any], engine: Optional[ReviewEngine] = None) -> Dict[str, Any]:
    eng = engine or ReviewEngine()
    return eng.propose(request)
