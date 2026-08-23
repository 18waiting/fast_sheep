"""In-memory repository test doubles (worker side, M1).

Clean-room implementation. Test infrastructure only; no business logic.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


class InMemoryKnowledgeRepository:
    def __init__(self) -> None:
        self._store: Dict[str, Dict[str, Any]] = {}

    def upsert(self, entry: Dict[str, Any]) -> None:
        if "id" not in entry:
            raise ValueError("knowledge entry missing id")
        self._store[entry["id"]] = {**entry, "tags": list(entry.get("tags") or [])}

    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        e = self._store.get(entry_id)
        return {**e, "tags": list(e["tags"])} if e else None

    def delete(self, entry_id: str) -> None:
        self._store.pop(entry_id, None)

    def list(self, limit: int = 500) -> List[Dict[str, Any]]:
        return [self.get(k) for k in list(self._store)[:limit]]  # type: ignore[misc]

    def query_by_product(self, product_id: str) -> List[Dict[str, Any]]:
        return [self.get(k) for k, v in self._store.items() if v["product_id"] == product_id]  # type: ignore[misc]

    def query_by_trust(self, trust_level: str) -> List[Dict[str, Any]]:
        return [self.get(k) for k, v in self._store.items() if v["trust_level"] == trust_level]  # type: ignore[misc]

    def count(self) -> int:
        return len(self._store)


class InMemoryKnowledgeCandidateRepository:
    def __init__(self) -> None:
        self._store: Dict[str, Dict[str, Any]] = {}

    def insert(self, cand: Dict[str, Any]) -> None:
        if "candidate_id" not in cand:
            raise ValueError("candidate missing candidate_id")
        cand = {**cand, "status": cand.get("status") or "PENDING_REVIEW", "tags": list(cand.get("tags") or [])}
        self._store[cand["candidate_id"]] = cand

    def update_status(self, candidate_id: str, status: str) -> None:
        if candidate_id in self._store:
            self._store[candidate_id]["status"] = status

    def get(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        c = self._store.get(candidate_id)
        return {**c, "tags": list(c["tags"])} if c else None

    def delete(self, candidate_id: str) -> None:
        self._store.pop(candidate_id, None)

    def list_pending(self) -> List[Dict[str, Any]]:
        return [self.get(k) for k, v in self._store.items() if v.get("status") in ("PENDING_REVIEW", "PENDING_REAUDIT")]  # type: ignore[misc]

    def count(self) -> int:
        return len(self._store)
