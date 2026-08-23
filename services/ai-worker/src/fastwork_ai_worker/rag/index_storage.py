"""Derived index filesystem storage (TASK-018 M3).

Atomic temp-write + rename/replace, metadata files, index version, safe loading,
and corruption isolation. Canonical knowledge is NEVER stored here — FAISS +
mappings are rebuildable derived state.
"""
from __future__ import annotations

import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import faiss  # noqa: E402 - eager main-thread import (thread imports can hang)

from .errors import index_corrupt

INDEX_SCHEMA_VERSION = 1

# Logical derived root (relative to the injected DATA_ROOT).
DERIVED_RAG_REL = os.path.join("derived", "rag")


def resolve_derived_root(data_root: str, config: Optional[Dict[str, Any]] = None) -> str:
    override = (config or {}).get("derived_root")
    if override:
        return os.path.abspath(override)
    return os.path.join(os.path.abspath(data_root), DERIVED_RAG_REL)


def global_index_path(root: str) -> str:
    return os.path.join(root, "global", "index.faiss")


def global_mapping_path(root: str) -> str:
    return os.path.join(root, "global", "mapping.json")


def common_index_path(root: str) -> str:
    return os.path.join(root, "common", "index.faiss")


def common_mapping_path(root: str) -> str:
    return os.path.join(root, "common", "mapping.json")


def product_index_path(root: str, product_id: str) -> str:
    return os.path.join(root, "products", _safe_segment(product_id), "index.faiss")


def product_mapping_path(root: str, product_id: str) -> str:
    return os.path.join(root, "products", _safe_segment(product_id), "mapping.json")


def index_meta_path(root: str) -> str:
    return os.path.join(root, "index-meta.json")


def _safe_segment(product_id: str) -> str:
    # Deterministic safe directory segment for arbitrary product ids.
    import hashlib

    if product_id and all(c.isalnum() or c in "-_." for c in product_id):
        return product_id
    return "p-" + hashlib.sha1(product_id.encode("utf-8")).hexdigest()[:16]


def build_meta(
    dimension: int,
    entry_count: int,
    source_revision: str,
    created_at: str,
) -> Dict[str, Any]:
    return {
        "index_schema_version": INDEX_SCHEMA_VERSION,
        "embedding_dimension": dimension,
        "metric": "INNER_PRODUCT",
        "entry_count": entry_count,
        "created_at": created_at,
        "source_revision": source_revision,
    }


def write_meta(root: str, meta: Dict[str, Any]) -> None:
    atomic_write_json(index_meta_path(root), meta)


def read_meta(root: str) -> Optional[Dict[str, Any]]:
    p = index_meta_path(root)
    if not os.path.exists(p):
        return None
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def atomic_write_json(path: str, obj: Any) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.parent / (".tmp-" + uuid.uuid4().hex)
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False)
        os.replace(tmp, target)
    except Exception:
        if tmp.exists():
            try:
                tmp.unlink()
            except Exception:
                pass
        raise


def atomic_write_bytes(path: str, data: bytes) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.parent / (".tmp-" + uuid.uuid4().hex)
    try:
        tmp.write_bytes(data)
        os.replace(tmp, target)
    except Exception:
        if tmp.exists():
            try:
                tmp.unlink()
            except Exception:
                pass
        raise


def safe_write_index(path: str, index) -> None:
    """Serialize a FAISS index to a temp file then atomically replace (non-ASCII safe)."""
    faiss = _import_faiss()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp-" + uuid.uuid4().hex
    try:
        faiss.write_index(index, tmp)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except Exception:
                pass


def safe_read_index(path: str):
    """Load a FAISS index; raises index_corrupt on any failure (never silent corruption)."""
    faiss = _import_faiss()
    try:
        return faiss.read_index(path)
    except Exception as e:  # noqa: BLE001
        raise index_corrupt("failed to load index " + str(path) + ": " + type(e).__name__) from e


def safe_write_mapping(path: str, mapping: List[Dict[str, Any]]) -> None:
    atomic_write_json(path, mapping)


def safe_read_mapping(path: str) -> List[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            raise ValueError("mapping must be a list")
        return data
    except Exception as e:  # noqa: BLE001
        raise index_corrupt("failed to load mapping " + str(path) + ": " + type(e).__name__) from e


def _import_faiss():
    return faiss  # imported eagerly at module load


def remove_stale_builds(root: str, keep: int = 1) -> None:
    """Cleanup policy: remove abandoned staging dirs, keep the latest few."""
    parent = Path(root).parent
    builds = sorted(parent.glob(".rag-build-*"))
    for b in builds[: max(0, len(builds) - keep)]:
        shutil.rmtree(b, ignore_errors=True)
