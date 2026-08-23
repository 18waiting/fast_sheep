"""KnowledgeCandidateRepository (worker-owned, M1).

Clean-room implementation. Derived only from public/project behavioral
specifications and frozen contracts. Persistence only.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Dict, List, Optional

ORIGINS = {"LEARNED", "GENERATED", "CORRECTION", "AUTO_INGEST", "REVIEW", "RESTORE"}
STATUSES = {"PENDING_REVIEW", "APPROVED", "REJECTED", "PENDING_REAUDIT", "COMMITTED"}


class KnowledgeCandidateRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def insert(self, cand: Dict[str, Any]) -> None:
        self._validate(cand)
        self._conn.execute(
            "INSERT INTO knowledge_candidates (candidate_id, source, question, answer, product_id, tags, origin, status, frequency, evidence) "
            "VALUES (?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(candidate_id) DO UPDATE SET status=excluded.status, source=excluded.source, "
            "question=excluded.question, answer=excluded.answer, product_id=excluded.product_id, "
            "tags=excluded.tags, origin=excluded.origin, frequency=excluded.frequency, evidence=excluded.evidence",
            (
                cand["candidate_id"],
                cand.get("source") or "",
                cand["question"],
                cand["answer"],
                cand.get("product_id") or "",
                json.dumps(cand.get("tags") or [], ensure_ascii=False),
                cand["origin"],
                cand.get("status") or "PENDING_REVIEW",
                json.dumps(cand.get("frequency") or {}, ensure_ascii=False) if cand.get("frequency") is not None else None,
                json.dumps(cand.get("evidence") or {}, ensure_ascii=False) if cand.get("evidence") is not None else None,
            ),
        )


    def update_status(self, candidate_id: str, status: str) -> None:
        if status not in STATUSES:
            raise ValueError(f"invalid candidate status {status}")
        self._conn.execute("UPDATE knowledge_candidates SET status = ? WHERE candidate_id = ?", (status, candidate_id))

    def get(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        row = self._conn.execute("SELECT * FROM knowledge_candidates WHERE candidate_id = ?", (candidate_id,)).fetchone()
        return self._map(row) if row else None

    def delete(self, candidate_id: str) -> None:
        self._conn.execute("DELETE FROM knowledge_candidates WHERE candidate_id = ?", (candidate_id,))

    def list_pending(self) -> List[Dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM knowledge_candidates WHERE status IN ('PENDING_REVIEW','PENDING_REAUDIT') ORDER BY candidate_id"
        ).fetchall()
        return [self._map(r) for r in rows]

    def count(self) -> int:
        return int(self._conn.execute("SELECT COUNT(*) AS c FROM knowledge_candidates").fetchone()["c"])

    @staticmethod
    def _validate(cand: Dict[str, Any]) -> None:
        for k in ("candidate_id", "question", "answer", "origin"):
            if k not in cand:
                raise ValueError(f"candidate missing required field {k}")
        if cand["origin"] not in ORIGINS:
            raise ValueError(f"invalid origin {cand['origin']}")
        if cand.get("status") is not None and cand["status"] not in STATUSES:
            raise ValueError(f"invalid status {cand['status']}")

    @staticmethod
    def _map(row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["tags"] = json.loads(d.get("tags") or "[]")
        for k in ("frequency", "evidence"):
            if d.get(k) is not None:
                d[k] = json.loads(d[k])
        return d
