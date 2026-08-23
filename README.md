# fastwork-rebuild — Clean-Room M0 Repository

> Clean-room implementation. Derived only from public/project behavioral specifications and frozen contracts (spec/, static/rebuild/, parity-tests/). Do not consult original proprietary source/binaries.

## M0 scope
Repository skeleton + canonical JSON Schema contracts + validation tooling + CI baseline. **No production business behavior** (no conversation engine, RAG, providers, platform adapters, repositories, or RPC transport) is implemented in M0.

## Package manager
- **pnpm** (workspaces; `pnpm-workspace.yaml`). pnpm 10.17.1 confirmed available. Fallback: npm workspaces.

## Install & commands
```
pnpm install
pnpm run typecheck        # strict TS across packages
pnpm run test             # per-package tests
pnpm run test:contracts   # schema compile + example + negative tests
pnpm run test:golden-schema  # validate 222 golden fixtures against golden-fixture.schema.json
pnpm run verify:frozen    # P0 manifest: count 174, paths, sha256, status
pnpm run verify:coverage  # behavior coverage: no uncovered P0
pnpm run scan:secrets     # secret-pattern guardrail
pnpm run check:boundary   # no forbidden reference artifacts referenced
pnpm run python:check     # compile + import fastwork_ai_worker
pnpm run ci               # all M0 gates
```

## Golden fixtures
- Consumed **read-only** from `../parity-tests/` (never copied into `rebuild/`).
- Frozen version: **2026-08-15.1**. `verify:frozen` recomputes SHA-256 and fails on mismatch; it never mutates fixtures or hashes.

## Terminology
- M0 gates report **GOLDEN INTEGRITY GREEN** (parse/schema/hash/coverage). **P0 PARITY GREEN** is not claimed until business implementations exist (M3+).

## Intentionally not implemented (M0)
Electron runtime, AI worker RPC transport (M2), RAG/FAISS (M3), prompt/tool/provider engines (M4), orchestrator (M5), platform adapters (M7/M8), handoff/feedback (M9), learning/review/optimization (M10), persistence (M1), legacy import (M11).

## Next milestone
TASK-016 — Persistence & Migrations / M1 Implementation.
