# @fastwork/contracts

Clean-room canonical contract layer. JSON Schema (Draft 2020-12) is the single source of truth; TypeScript types mirror but do not replace it. Contract validation operates against JSON Schema at process boundaries.

- `schemas/` — canonical schemas (rpc/, domain/, events/, config/, errors/, common/).
- `contract-registry.json` — machine-readable registry of all contracts.
- `behavior-contract-map.json` — behavior ID → contract schema IDs → milestone.
- `src/` — registry loader + Ajv-based schema compiler/validator.

## Decisions
- Schema draft: **2020-12** (recorded; TASK-014 golden-fixture.schema.json retains draft-07 for compatibility).
- Strict envelopes use `additionalProperties: false`; extension-bearing fields (`details`, `metadata`, `payload`) explicitly allow structured extras.
- `request_id`/`correlation_id` are plain non-empty strings (UUID not required by contract; recorded as DESIGN choice).
- Secrets are never contract values: configs carry `credential_ref` (ADR-004).
