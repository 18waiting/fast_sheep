"""IndexRepository (TASK-018 M3): FAISS index lifecycle + mapping + bounded cache.

Owns the derived-state semantics: global / common / per-product IndexIDMap2
over IndexFlatIP, faiss-id <-> knowledge-entry-id mapping, thread-safe cache,
and index metadata. Retrieval policy lives elsewhere.
"""
from __future__ import annotations

import threading
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from . import index_storage as storage
from .errors import index_corrupt, index_not_ready, invalid_dimension
from .types import IndexStatus
from .vector_math import l2_normalize, validate_dimension


class IndexRepository:
    """Holds loaded indexes with a bounded LRU product-index cache."""

    def __init__(self, data_root: str, config: Optional[Dict[str, Any]] = None, dimension: int = 1024):
        self.data_root = data_root
        self.config = config or {}
        self.root = storage.resolve_derived_root(data_root, config)
        self.dimension = int(self.config.get("embedding_dim", dimension))
        cache_size = int(self.config.get("index_cache_size", 16))
        self._cache: "OrderedDict[str, Any]" = OrderedDict()
        self._cache_limit = max(1, cache_size)
        self._global: Optional[Any] = None
        self._common: Optional[Any] = None
        self._global_mapping: List[Dict[str, Any]] = []
        self._common_mapping: List[Dict[str, Any]] = []
        self._lock = threading.RLock()  # guards cache + loaded global/common
        self._build_lock = threading.RLock()  # one authoritative rebuild at a time
        self._meta: Optional[Dict[str, Any]] = None

    # ---- loading -----------------------------------------------------------
    def _load_index(self, path: str):
        if not os_path_exists(path):
            return None
        return storage.safe_read_index(path)

    def ensure_global(self) -> Optional[Any]:
        with self._lock:
            if self._global is None:
                idx = self._load_index(storage.global_index_path(self.root))
                if idx is not None:
                    self._validate_index(idx)
                    self._global = idx
                    self._global_mapping = storage.safe_read_mapping(storage.global_mapping_path(self.root))
            return self._global

    def ensure_common(self) -> Optional[Any]:
        with self._lock:
            if self._common is None:
                idx = self._load_index(storage.common_index_path(self.root))
                if idx is not None:
                    self._validate_index(idx)
                    self._common = idx
                    self._common_mapping = storage.safe_read_mapping(storage.common_mapping_path(self.root))
            return self._common

    def ensure_product(self, product_id: str) -> Optional[Any]:
        with self._lock:
            key = "product:" + product_id
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
            idx = self._load_index(storage.product_index_path(self.root, product_id))
            if idx is None:
                return None
            self._validate_index(idx)
            self._cache[key] = idx
            while len(self._cache) > self._cache_limit:
                self._cache.popitem(last=False)  # LRU eviction
            return idx

    def _validate_index(self, idx: Any) -> None:
        dim = int(idx.d)
        if dim != self.dimension:
            raise invalid_dimension(f"index dimension {dim} != configured {self.dimension}")

    # ---- search ------------------------------------------------------------
    def search(
        self,
        kind: str,
        query_vector: np.ndarray,
        top_k: int,
        product_id: Optional[str] = None,
    ) -> List[Tuple[int, float]]:
        """Search one index kind (common|product|global); returns [(faiss_id, score)]."""
        validate_dimension(query_vector, self.dimension)
        q = np.ascontiguousarray(l2_normalize(query_vector), dtype=np.float32).reshape(1, -1)
        index = None
        if kind == "common":
            index = self.ensure_common()
        elif kind == "product":
            if product_id is None:
                return []
            index = self.ensure_product(product_id)
        elif kind == "global":
            index = self.ensure_global()
        if index is None:
            return []
        if index.ntotal == 0:
            return []
        k = min(int(top_k), int(index.ntotal))
        if k <= 0:
            return []
        scores, ids = index.search(q, k)
        out: List[Tuple[int, float]] = []
        for i in range(len(ids[0])):
            fid = int(ids[0][i])
            score = float(scores[0][i])
            if fid == -1:
                continue
            out.append((fid, score))
        return out

    def mapping_for(self, kind: str, product_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if kind == "common":
            return self._common_mapping
        if kind == "global":
            return self._global_mapping
        if kind == "product":
            return storage.safe_read_mapping(storage.product_mapping_path(self.root, product_id or ""))
        return []

    def resolve_entry(self, kind: str, faiss_id: int, product_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        for m in self.mapping_for(kind, product_id):
            if int(m.get("faiss_id", -1)) == faiss_id:
                return m
        return None

    # ---- build lifecycle ---------------------------------------------------
    def build_lock(self):
        return self._build_lock

    def swap_in(self, built_root: str) -> None:
        """Atomically replace the active derived root with a freshly built one."""
        with self._build_lock:
            staging_parent = os_path_dirname(self.root)
            backup = self.root + ".old-" + _uuid_hex()
            had_old = os_path_exists(self.root)
            if had_old:
                os_rename(self.root, backup)
            try:
                os_rename(built_root, self.root)
            except Exception:
                if had_old:
                    os_rename(backup, self.root)
                raise
            if had_old and os_path_exists(backup):
                import shutil

                shutil.rmtree(backup, ignore_errors=True)
            # Drop cached objects so subsequent reads load the new index.
            with self._lock:
                self._global = None
                self._common = None
                self._global_mapping = []
                self._common_mapping = []
                self._cache.clear()
                self._meta = None

    def invalidate(self) -> None:
        with self._lock:
            self._global = None
            self._common = None
            self._global_mapping = []
            self._common_mapping = []
            self._cache.clear()
            self._meta = None

    def meta(self) -> Optional[Dict[str, Any]]:
        if self._meta is None:
            self._meta = storage.read_meta(self.root)
        return self._meta

    def ready(self) -> bool:
        return os_path_exists(storage.index_meta_path(self.root)) and os_path_exists(
            storage.global_index_path(self.root)
        )

    def status(self) -> IndexStatus:
        meta = self.meta() or {}
        global_idx = self.ensure_global()
        common_idx = self.ensure_common()
        global_count = int(global_idx.ntotal) if global_idx is not None else 0
        common_count = int(common_idx.ntotal) if common_idx is not None else 0
        products_dir = os_path_join(self.root, "products")
        product_index_count = 0
        if os_path_exists(products_dir):
            for entry in os_listdir(products_dir):
                if os_path_isdir(os_path_join(products_dir, entry)) and os_path_exists(
                    os_path_join(products_dir, entry, "index.faiss")
                ):
                    product_index_count += 1
        return IndexStatus(
            ready=self.ready(),
            dimension=self.dimension,
            metric="INNER_PRODUCT",
            global_count=global_count,
            product_index_count=product_index_count,
            common_count=common_count,
            last_build_at=meta.get("created_at"),
            index_schema_version=int(meta.get("index_schema_version", storage.INDEX_SCHEMA_VERSION)),
            derived_root=self.root,
        )


def os_path_exists(p: str) -> bool:
    import os

    return os.path.exists(p)


def os_path_join(*parts: str) -> str:
    import os

    return os.path.join(*parts)


def os_path_dirname(p: str) -> str:
    import os

    return os.path.dirname(p)


def os_path_isdir(p: str) -> bool:
    import os

    return os.path.isdir(p)


def os_listdir(p: str):
    import os

    return os.listdir(p)


def os_rename(a: str, b: str) -> None:
    import os

    os.rename(a, b)


def _uuid_hex() -> str:
    import uuid

    return uuid.uuid4().hex
