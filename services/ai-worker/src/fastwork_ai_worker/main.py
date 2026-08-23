"""M2 entrypoint for the clean-room AI worker.

Starts the stdio JSONL RPC server (python -m fastwork_ai_worker). No AI logic, no
provider request, no FAISS, no listening socket. stdout is protocol-only.
"""
from __future__ import annotations

import asyncio
import sys
from typing import Optional

from ._version import __version__
from .rpc.server import serve_stdio


def main(argv: Optional[list] = None) -> int:
    """Entrypoint: --version prints the version; otherwise run the stdio RPC server."""
    argv = argv if argv is not None else sys.argv[1:]
    if "--version" in argv:
        print(__version__)
        return 0
    try:
        return asyncio.run(serve_stdio())
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
