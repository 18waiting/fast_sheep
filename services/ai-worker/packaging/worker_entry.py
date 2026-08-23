"""PACK-002 thin packaging entrypoint (clean-room).

Delegates to the existing `fastwork_ai_worker.main:main` stdio JSONL RPC worker.
No RPC/RAG/business logic is reimplemented here; no source-tree import path is
added at runtime (PyInstaller bundles the package into _internal).
"""
from __future__ import annotations

import sys

from fastwork_ai_worker.main import main

if __name__ == "__main__":
    raise SystemExit(main())
