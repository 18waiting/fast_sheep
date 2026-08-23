"""Legacy import RPC methods (M11). Narrow surface:
legacy_import.validate_knowledge / apply_knowledge / verify_knowledge.
No arbitrary filesystem browsing RPC.
"""
from __future__ import annotations

from typing import Any, Dict

from ...legacy_import.knowledge_import_service import KnowledgeImportService
from ...legacy_import.knowledge_csv_parser import parse_knowledge_csv
from ...legacy_import.errors import LegacyImportError
from .. import protocol as rpc_protocol

SCHEMAS = {
    "legacy_import.validate_knowledge": "fastwork:import:knowledge-import-request",
    "legacy_import.apply_knowledge": "fastwork:import:knowledge-import-request",
    "legacy_import.verify_knowledge": "fastwork:import:knowledge-import-result",
}


class LegacyImportMethods:
    def __init__(self, server: Any = None) -> None:
        self._server = server
        self._service: KnowledgeImportService | None = None

    def register(self, dispatcher: Any) -> None:
        dispatcher.register("legacy_import.validate_knowledge", self.validate_knowledge)
        dispatcher.register("legacy_import.apply_knowledge", self.apply_knowledge)
        dispatcher.register("legacy_import.verify_knowledge", self.verify_knowledge)

    def _get_service(self) -> KnowledgeImportService:
        if self._service is None:
            import os
            from ...persistence import open_worker_db, KnowledgeRepository, KnowledgeCandidateRepository
            conn = open_worker_db(os.environ.get("FASTWORK_DATA_DIR", ""))
            self._service = KnowledgeImportService(
                knowledge_repo=KnowledgeRepository(conn),
                candidate_repo=KnowledgeCandidateRepository(conn),
                conn=conn,
            )
        return self._service

    async def validate_knowledge(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        ok, errs = rpc_protocol.validate_rpc_envelope(SCHEMAS["legacy_import.validate_knowledge"], payload)
        if not ok:
            raise LegacyImportError("import.validation_error", "; ".join(errs))
        rows = _normalize_rows(payload.get("rows") or [])
        return self._get_service().validate(rows)

    async def apply_knowledge(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        ok, errs = rpc_protocol.validate_rpc_envelope(SCHEMAS["legacy_import.apply_knowledge"], payload)
        if not ok:
            raise LegacyImportError("import.validation_error", "; ".join(errs))
        rows = _normalize_rows(payload.get("rows") or [])
        result = self._get_service().apply(
            str(payload.get("selection_id") or ""),
            str(payload.get("item_id") or ""),
            rows,
            str(payload.get("library") or ""),
        )
        return {
            "inserted": result.inserted,
            "skipped_duplicates": result.skipped_duplicates,
            "candidates": result.candidates,
            "trust_map": result.trust_map,
            "ok": True,
        }

    async def verify_knowledge(self, req: Dict[str, Any]) -> Dict[str, Any]:
        payload = req.get("payload") or {}
        return self._get_service().verify(str(payload.get("item_id") or ""))


def _normalize_rows(rows: list) -> list:
    out = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        out.append({
            "question": str(row.get("question") or row.get("问题") or ""),
            "answer": str(row.get("answer") or row.get("答案") or ""),
            "product_id": str(row.get("product_id") or row.get("商品ID") or row.get("商品Id") or ""),
            "tags": row.get("tags") or [],
            "library": str(row.get("library") or ""),
        })
    return out
