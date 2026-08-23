"""Handoff rule repository (M9, clean-room). READ-ONLY over canonical transfer_rules.
The worker NEVER writes transfer_rules; this repository only loads rows."""
from __future__ import annotations

import sqlite3
from typing import Any, Dict, List
from .rule_model import parse_rule
from .types import HandoffRule


class RuleRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def load_all(self) -> List[HandoffRule]:
        try:
            rows = self._conn.execute(
                "SELECT keyword, transfer_to, transfer_message, work_hours, source_agent, "
                "status, order_state, applicable_shops, sort_order, enabled FROM transfer_rules "
                "ORDER BY sort_order, id"
            ).fetchall()
        except sqlite3.Error:
            return []
        rules: List[HandoffRule] = []
        for row in rows:
            rules.append(parse_rule(dict(row)))
        return rules

    def load_csv_rows(self, rows: List[Dict[str, Any]]) -> List[HandoffRule]:
        """Load from an in-memory list of rule dicts (fixture/golden path)."""
        return [parse_rule(r) for r in rows]
