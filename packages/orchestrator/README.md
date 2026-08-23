# @fastwork/orchestrator

TypeScript conversation orchestrator for the FastWork clean-room rebuild (TASK-020 / M5).

This package is the single Main-side authority for message receipt, generation tokens,
suggestion lifecycle, human review, full auto, countdown, manual send, NO_SAVE,
new-message invalidation, stale-result rejection, pre-send revalidation, manual takeover,
takeover breaker, per-conversation send serialization, segmented send, send failure,
multi-shop isolation, TransferDecision consumption, and FeedbackIntent emission.

It does not perform RAG/Prompt/Provider/Tool work. Those concerns live in the Python
AI worker. Platform access is expressed through the generic `PlatformAdapter` port; no
real platform DOM code belongs in this package.

## Layout

- `src/ports` — stable interfaces used by the orchestrator and tests.
- `src/state` — runtime state, generation token, and suggestion state.
- `src/policies` — small, deterministic decision policies.
- `src/core` — orchestrator, shop registry, suggestion/countdown/send/takeover machinery.
- `src/adapters` — adapters for worker AI results and persistence repositories.
- `src/pre-send` — forbidden-word filter and message cleaner.

## Build and test

```powershell
pnpm --filter @fastwork/orchestrator run build
pnpm --filter @fastwork/orchestrator run test
```