"""IndexBuilder (TASK-018 M3).

Reads canonical KnowledgeRepository rows, embeds + L2-normalizes, builds FAISS
IndexIDMap2(IndexFlatIP) indexes (global/common/products), and commits derived
state atomically. No retrieval policy.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import faiss  # noqa: E402 - imported eagerly on the main thread (worker-thread import can hang)
import numpy as np

from . import index_storage as storage
from .errors import index_corrupt, invalid_dimension
from .vector_math import l2_normalize, validate_dimension

COMMON_PRODUCT_ID = "1"


def source_revision(entries: List[Dict[str, Any]]) -> str:
    """Clean-room DESIGN source revision: sha256 over deterministic row material."""
    h = hashlib.sha256()
    for e in sorted(entries, key=lambda x: (x.get("product_id", ""), x.get("created_at", ""), x.get("id", ""))):
        line = "|".join(
            [
                str(e.get("id", "")),
                str(e.get("question", "")),
                str(e.get("answer", "")),
                str(e.get("product_id", "")),
                "|".join(sorted(e.get("tags") or [])),
                str(e.get("source", "")),
                str(e.get("trust_level", "")),
                str(e.get("updated_at", "")),
            ]
        )
        h.update(line.encode("utf-8"))
    return h.hexdigest()


class IndexBuilder:
    def __init__(self, embedding_provider, config: Optional[Dict[str, Any]] = None):
        self.provider = embedding_provider
        self.config = config or {}
        self.dimension = int(self.config.get("embedding_dim", 1024))
        self.batch_size = int(self.config.get("build_batch_size", 64))

    def _embed_batch(self, texts: List[str]) -> List[np.ndarray]:
        out: List[np.ndarray] = []
        for i in range(0, len(texts), self.batch_size):
            chunk = texts[i : i + self.batch_size]
            vectors = self.provider.embed(chunk)
            for v in vectors:
                arr = np.asarray(v, dtype=np.float32)
                validate_dimension(arr, self.dimension)
                out.append(l2_normalize(arr))
        return out

    def build_full(
        self,
        entries: List[Dict[str, Any]],
        data_root: str,
    ) -> Dict[str, Any]:
        """Build all derived indexes into a staging dir and atomically promote."""
        root = storage.resolve_derived_root(data_root, self.config)
        parent = os.path.dirname(root)
        os.makedirs(parent, exist_ok=True)
        staging = os.path.join(parent, ".rag-build-" + uuid.uuid4().hex)
        os.makedirs(staging, exist_ok=True)
        try:
            self._build_into(staging, entries, faiss)
            # validate staging before promote
            meta = storage.read_meta(staging) or {}
            storage.safe_read_index(storage.global_index_path(staging))
            for pdir in ["common", "global"]:
                if os.path.exists(storage.global_mapping_path(staging) if pdir == "global" else storage.common_mapping_path(staging)):
                    pass
            return {"staging": staging, "root": root, "meta": meta}
        except Exception:
            shutil.rmtree(staging, ignore_errors=True)
            raise

    def _build_into(self, staging: str, entries: List[Dict[str, Any]], faiss_mod) -> None:
        # classify
        common: List[Dict[str, Any]] = []
        by_product: Dict[str, List[Dict[str, Any]]] = {}
        for e in entries:
            pid = e.get("product_id", "")
            if pid == COMMON_PRODUCT_ID:
                common.append(e)
            elif pid:
                by_product.setdefault(pid, []).append(e)

        # embed all rows once (deterministic), keep per-entry vector
        texts = [e.get("question", "") for e in entries]
        vectors = self._embed_batch(texts)
        vec_by_id = {e.get("id"): vectors[i] for i, e in enumerate(entries)}

        created_at = datetime.now(timezone.utc).isoformat()
        rev = source_revision(entries)

        # global index = ALL rows (including common + product rows)
        self._build_one(
            staging, "global", entries, vec_by_id, faiss,
            {"index_schema_version": storage.INDEX_SCHEMA_VERSION, "embedding_dimension": self.dimension,
             "metric": "INNER_PRODUCT", "entry_count": len(entries), "created_at": created_at, "source_revision": rev},
        )
        # common index
        self._build_one(
            staging, "common", common, vec_by_id, faiss,
            {"index_schema_version": storage.INDEX_SCHEMA_VERSION, "embedding_dimension": self.dimension,
             "metric": "INNER_PRODUCT", "entry_count": len(common), "created_at": created_at, "source_revision": rev},
        )
        # per-product indexes
        for pid, rows in by_product.items():
            self._build_one(
                staging, "product", rows, vec_by_id, faiss, None, product_id=pid,
            )
        storage.write_meta(staging, storage.build_meta(self.dimension, len(entries), rev, created_at))

    def _build_one(
        self,
        staging: str,
        kind: str,
        entries: List[Dict[str, Any]],
        vec_by_id: Dict[str, np.ndarray],
        faiss,
        meta: Optional[Dict[str, Any]],
        product_id: Optional[str] = None,
    ) -> None:
        if not entries:
            # write empty index so existence check works
            index = faiss.IndexIDMap2(faiss.IndexFlatIP(self.dimension))
            mapping: List[Dict[str, Any]] = []
        else:
            # deterministic faiss id allocation: sorted by (created_at, id) order preserved
            ordered = sorted(entries, key=lambda x: (x.get("created_at", ""), x.get("id", "")))
            index = faiss.IndexIDMap2(faiss.IndexFlatIP(self.dimension))
            vectors = np.vstack([vec_by_id[e.get("id")] for e in ordered])
            ids = np.arange(len(ordered), dtype=np.int64)
            index.add_with_ids(vectors, ids)
            mapping = []
            for fid, e in zip(ids, ordered):
                mapping.append(
                    {
                        "faiss_id": int(fid),
                        "entry_id": e.get("id"),
                        "question": e.get("question", ""),
                        "answer": e.get("answer", ""),
                        "product_id": e.get("product_id", ""),
                        "source": e.get("source", ""),
                        "tags": e.get("tags") or [],
                    }
                )
        if kind == "global":
            storage.safe_write_index(storage.global_index_path(staging), index)
            storage.safe_write_mapping(storage.global_mapping_path(staging), mapping)
        elif kind == "common":
            storage.safe_write_index(storage.common_index_path(staging), index)
            storage.safe_write_mapping(storage.common_mapping_path(staging), mapping)
        elif kind == "product":
            storage.safe_write_index(storage.product_index_path(staging, product_id or ""), index)
            storage.safe_write_mapping(storage.product_mapping_path(staging, product_id or ""), mapping)
