# fastwork-ai-worker (M0 skeleton)

Clean-room Python AI worker package (`fastwork_ai_worker`). M0 contains only:

- `__version__`
- a placeholder `main()` that prints a bootstrap message when executed explicitly in development
- contract-discovery helper (`FASTWORK_CONTRACTS_DIR` injection) — no coupling to the reverse-engineering project root

**Not implemented in M0** (later milestones): stdio JSONL RPC transport (M2), RAG/FAISS (M3),
prompt/tool/provider engines (M4), handoff (M9), knowledge lifecycle (M10).

## Contract visibility
The worker discovers the JSON Schema source via an injected path (`FASTWORK_CONTRACTS_DIR` env) or a
packaged contract bundle path. In development, the CI check passes `rebuild/packages/contracts/schemas`.
M2+ will bundle the contracts with the worker distribution.

## Checks
```
python -m compileall -q src
python -c "import sys; sys.path.insert(0,'src'); import fastwork_ai_worker; print(fastwork_ai_worker.__version__)"
```
