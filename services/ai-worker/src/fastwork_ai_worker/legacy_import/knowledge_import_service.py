"""Legacy knowledge import service (M11, clean-room). Worker single-writer for
knowledge_entries / knowledge_candidates. Idempotent: deterministic import
identity + upsert (repeated apply inserts zero duplicate logical rows).
"""
from __future__ import annotations

from typing import Any, Dict, List

from .knowledge_state_mapper import library_for_path, map_rows_to_entries, trust_for_library
from .candidate_parser import map_candidates
from .types import KnowledgeImportResult


class KnowledgeImportService:
    def __init__(self, knowledge_repo: Any = None, candidate_repo: Any = None, conn: Any = None):
        self._knowledge = knowledge_repo
        self._candidates = candidate_repo
        self._conn = conn

    def validate(self, rows: List[Dict[str, str]]) -> Dict[str, Any]:
        errors = []
        valid = 0
        for i, row in enumerate(rows or []):
            q = str(row.get("question") or row.get("问题") or "")
            a = str(row.get("answer") or row.get("答案") or "")
            if not q or not a:
                errors.append(f"row {i}: missing question or answer")
                continue
            valid += 1
        return {"ok": len(errors) == 0, "errors": errors, "rows": valid}

    def apply(self, selection_id: str, item_id: str, rows: List[Dict[str, str]], library: str = "") -> KnowledgeImportResult:
        result = KnowledgeImportResult()
        result.trust_map = {"A库": trust_for_library("A库"), "B库": trust_for_library("B库"), "待审核": trust_for_library("待审核")}
        lib = library or library_for_path(item_id)

        if lib == "待审核":
            # 待审核 rows become knowledge_candidates (PENDING_REVIEW), not knowledge_entries.
            for c in map_candidates(selection_id, item_id, rows, "待审核"):
                if self._candidates is None:
                    continue
                existing = self._candidates.get(c["candidate_id"])
                if existing is not None:
                    result.skipped_duplicates += 1
                    continue
                self._candidates.insert(c)
                result.candidates += 1
            self._commit()
            return result

        for entry in map_rows_to_entries(selection_id, item_id, rows, lib):
            if not entry["question"] or not entry["answer"]:
                continue
            existing = self._knowledge.get(entry["id"]) if self._knowledge is not None else None
            if existing is not None:
                result.skipped_duplicates += 1
                continue
            self._knowledge.upsert(entry)
            result.inserted += 1
        self._commit()
        return result

    def verify(self, item_id: str) -> Dict[str, Any]:
        kcount = 0
        if self._knowledge is not None:
            kcount = len(self._knowledge.list())
        ccount = 0
        if self._candidates is not None:
            ccount = len(self._candidates.list_pending() if hasattr(self._candidates, "list_pending") else self._candidates.list())
        counts = {"knowledge": kcount, "candidates": ccount}
        return {"ok": True, "counts": counts}

    def _commit(self) -> None:
        conn = getattr(self._knowledge, "_conn", None) or self._conn
        if conn is not None:
            try:
                conn.commit()
            except Exception:
                pass
