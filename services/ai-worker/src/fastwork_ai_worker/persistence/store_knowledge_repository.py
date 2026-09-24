"""StoreKnowledgeRepository (SHEEP-305, worker-side, MVP-A).

Minimal keyword-based retrieval for Store Knowledge (DEC-008 layer 3).
Read-only from the worker side; writes happen on the Desktop main process.

MVP-A scope:
  - Keyword retrieval via SQL LIKE matching
  - Scope filtering by merchant_id + store_id
  - Type filtering by knowledge_type
  - Status filtering (default: ACTIVE only)

Deferred to Phase 9:
  - Vector retrieval (embeddings + FAISS)
  - Learning model
  - Complex conflict resolution
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Dict, List, Optional, Sequence

VALID_KNOWLEDGE_TYPES = {"SHIPPING_TIME", "RETURN_POLICY", "FAQ", "OTHER"}
VALID_STATUSES = {"ACTIVE", "DRAFT", "ARCHIVED"}


class StoreKnowledgeRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def _ensure_table(self) -> None:
        """Defensive check that the table exists."""
        row = self._conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='store_knowledge'"
        ).fetchone()
        if not row:
            raise RuntimeError("store_knowledge table not found — run migration 0008 first")

    def get(self, entry_id: str, merchant_id: str) -> Optional[Dict[str, Any]]:
        self._ensure_table()
        row = self._conn.execute(
            "SELECT * FROM store_knowledge WHERE id = ? AND merchant_id = ?",
            (entry_id, merchant_id),
        ).fetchone()
        return self._map(row) if row else None

    def list(
        self,
        merchant_id: str,
        store_id: str,
        knowledge_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        self._ensure_table()
        conditions = ["merchant_id = ?", "store_id = ?"]
        params: list = [merchant_id, store_id]

        if knowledge_type:
            if knowledge_type not in VALID_KNOWLEDGE_TYPES:
                return []
            conditions.append("knowledge_type = ?")
            params.append(knowledge_type)
        if status:
            if status not in VALID_STATUSES:
                return []
            conditions.append("status = ?")
            params.append(status)

        conditions.append("1=1")  # always true, simplifies logic
        sql = f"SELECT * FROM store_knowledge WHERE {' AND '.join(conditions[:2] + conditions[2:])} ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)
        rows = self._conn.execute(sql, params).fetchall()
        return [self._map(r) for r in rows]

    def query(
        self,
        merchant_id: str,
        store_id: str,
        keywords: Optional[Sequence[str]] = None,
        knowledge_type: Optional[str] = None,
        status: str = "ACTIVE",
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Keyword-based retrieval for AI reply generation.

        MVP-A: SQL LIKE matching on title, content, and tags.
        An entry matches if ANY keyword matches ANY of the three fields.
        """
        self._ensure_table()
        conditions = ["merchant_id = ?", "store_id = ?"]
        params: list = [merchant_id, store_id]

        if knowledge_type:
            if knowledge_type not in VALID_KNOWLEDGE_TYPES:
                return []
            conditions.append("knowledge_type = ?")
            params.append(knowledge_type)

        if status:
            if status not in VALID_STATUSES:
                return []
            conditions.append("status = ?")
            params.append(status)

        if keywords:
            keyword_clauses = []
            for kw in keywords:
                pattern = f"%{kw}%"
                keyword_clauses.append("(title LIKE ? OR content LIKE ? OR tags LIKE ?)")
                params.extend([pattern, pattern, pattern])
            if keyword_clauses:
                conditions.append(f"({' OR '.join(keyword_clauses)})")

        sql = f"SELECT * FROM store_knowledge WHERE {' AND '.join(conditions)} ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)
        rows = self._conn.execute(sql, params).fetchall()
        return [self._map(r) for r in rows]

    def _map(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["tags"] = self._parse_tags(d.get("tags", "[]"))
        return d

    @staticmethod
    def _parse_tags(raw: str) -> List[str]:
        try:
            parsed = json.loads(raw)
            return [t for t in parsed if isinstance(t, str)] if isinstance(parsed, list) else []
        except (json.JSONDecodeError, TypeError):
            return []
