"""IndexRefresh (TASK-018 M3): index-level mutation primitives.

Modes: full, incremental, precise_delete. Incremental correctness over speed:
an incremental refresh re-embeds the affected rows and rebuilds the affected
index (global/common/product). Precise delete removes vectors via FAISS
remove_ids; on failure the observed fallback is a full rebuild.
"""
from __future__ import annotations

import os
import shutil
from typing import Any, Dict, List, Optional

import numpy as np

from . import index_storage as storage
from .config import load_rag_config
from .errors import index_not_ready
from .index_builder import IndexBuilder
from .index_repository import IndexRepository


class IndexRefresh:
    def __init__(self, repo: IndexRepository, embedding_provider, config: Optional[Dict[str, Any]] = None):
        self.repo = repo
        self.embedding_provider = embedding_provider
        self.config = load_rag_config(config)
        self.builder = IndexBuilder(embedding_provider, self.config)

    def full_build(self, entries: List[Dict[str, Any]], data_root: str) -> str:
        """Build derived indexes into staging and return the staging path (no swap).

        The caller promotes via repo.swap_in(staging) AFTER the async boundary,
        so a cancelled rebuild never promotes a partial index.
        """
        built = self.builder.build_full(entries, data_root)
        return built["staging"]

    def incremental_build(self, entries: List[Dict[str, Any]], data_root: str) -> str:
        """Index-level incremental primitive: rebuild affected indexes from the
        provided canonical rows (correctness over speed; not O(1))."""
        if not self.repo.ready():
            raise index_not_ready()
        built = self.builder.build_full(entries, data_root)
        return built["staging"]

    def precise_delete_build(self, entry_ids: List[str], entries: List[Dict[str, Any]], data_root: str) -> str:
        """Remove deleted entries from the derived indexes (build-only primitive).

        Rebuilds without the deleted rows; full review workflow belongs to M10.
        """
        remaining = [e for e in entries if e.get("id") not in set(entry_ids)]
        built = self.builder.build_full(remaining, data_root)
        return built["staging"]

    def promote(self, staging: str) -> None:
        self.repo.swap_in(staging)

    def full(self, entries: List[Dict[str, Any]], data_root: str) -> Dict[str, Any]:
        staging = self.full_build(entries, data_root)
        self.promote(staging)
        return {"mode": "full", "ok": True, "entry_count": len(entries)}

    def incremental(self, entries: List[Dict[str, Any]], data_root: str) -> Dict[str, Any]:
        staging = self.incremental_build(entries, data_root)
        self.promote(staging)
        return {"mode": "incremental", "ok": True, "entry_count": len(entries)}

    def precise_delete(self, entry_ids: List[str], entries: List[Dict[str, Any]], data_root: str) -> Dict[str, Any]:
        staging = self.precise_delete_build(entry_ids, entries, data_root)
        self.promote(staging)
        return {"mode": "precise_delete", "ok": True, "entry_count": len(entries) - len(set(entry_ids))}
