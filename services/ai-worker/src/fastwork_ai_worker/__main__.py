"""Allow 'python -m fastwork_ai_worker' to start the M2 stdio RPC server."""
from .main import main

if __name__ == "__main__":
    raise SystemExit(main())
