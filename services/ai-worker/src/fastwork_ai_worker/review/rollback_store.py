"""Review rollback store (M10): durable snapshots for rollback/restore."""
from __future__ import annotations

import json
from typing import Any, Dict, Optional


class RollbackStore:
    def __init__(self, conn: Any):
        self._conn = conn

    def snapshot(self, entry_id: str, entry: Dict[str, Any]) -> str:
        rid = "rb-" + entry_id
        self._conn.execute(
            "INSERT OR REPLACE INTO review_rollbacks (id, entry_id, snapshot_json, created_at) VALUES (?,?,?,?)",
            (rid, entry_id, json.dumps(entry, ensure_ascii=False), "2026-08-16T00:00:00Z"),
        )
        self._conn.commit()
        return rid

    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        row = self._conn.execute("SELECT snapshot_json FROM review_rollbacks WHERE entry_id = ?", (entry_id,)).fetchone()
        if row is None:
            return None
        if isinstance(row, dict):
            snap = row["snapshot_json"]
        elif hasattr(row, "keys"):
            snap = row["snapshot_json"]
        else:
            snap = row[0]
        return json.loads(snap)
