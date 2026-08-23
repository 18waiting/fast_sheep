"""KnowledgeRepository (worker-owned, M1).

Clean-room implementation. Derived only from public/project behavioral
specifications and frozen contracts. Persistence only — no RAG, no FAISS,
no learning/review algorithms. Tags are stored as JSON text (decision recorded
in spec/rebuild/m1-schema-report.md); order/round-trip preserved.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Dict, List, Optional

TRUST_LEVELS = {"AUTO", "GENERATED", "PENDING", "HUMAN_CONFIRMED", "PROTECTED"}


class KnowledgeRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def upsert(self, entry: Dict[str, Any]) -> None:
        self._validate(entry)
        self._conn.execute(
            "INSERT INTO knowledge_entries (id, question, answer, product_id, tags, source, trust_level, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET question=excluded.question, answer=excluded.answer, "
            "product_id=excluded.product_id, tags=excluded.tags, source=excluded.source, "
            "trust_level=excluded.trust_level, updated_at=excluded.updated_at",
            (
                entry["id"],
                entry["question"],
                entry["answer"],
                entry["product_id"],
                json.dumps(entry.get("tags") or [], ensure_ascii=False),
                entry.get("source") or "",
                entry["trust_level"],
                entry["created_at"],
                entry["updated_at"],
            ),
        )


    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        row = self._conn.execute("SELECT * FROM knowledge_entries WHERE id = ?", (entry_id,)).fetchone()
        return self._map(row) if row else None

    def delete(self, entry_id: str) -> None:
        self._conn.execute("DELETE FROM knowledge_entries WHERE id = ?", (entry_id,))

    def list(self, limit: int = 500) -> List[Dict[str, Any]]:
        rows = self._conn.execute("SELECT * FROM knowledge_entries ORDER BY created_at, id LIMIT ?", (limit,)).fetchall()
        return [self._map(r) for r in rows]

    def query_by_product(self, product_id: str) -> List[Dict[str, Any]]:
        rows = self._conn.execute("SELECT * FROM knowledge_entries WHERE product_id = ? ORDER BY created_at, id", (product_id,)).fetchall()
        return [self._map(r) for r in rows]

    def query_by_trust(self, trust_level: str) -> List[Dict[str, Any]]:
        rows = self._conn.execute("SELECT * FROM knowledge_entries WHERE trust_level = ? ORDER BY created_at, id", (trust_level,)).fetchall()
        return [self._map(r) for r in rows]

    def count(self) -> int:
        return int(self._conn.execute("SELECT COUNT(*) AS c FROM knowledge_entries").fetchone()["c"])

    @staticmethod
    def _validate(entry: Dict[str, Any]) -> None:
        for k in ("id", "question", "answer", "product_id", "trust_level", "created_at", "updated_at"):
            if k not in entry:
                raise ValueError(f"knowledge entry missing required field {k}")
        if entry["trust_level"] not in TRUST_LEVELS:
            raise ValueError(f"invalid trust_level {entry['trust_level']}")

    @staticmethod
    def _map(row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["tags"] = json.loads(d.get("tags") or "[]")
        return d
