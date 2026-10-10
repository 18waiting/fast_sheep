# Handoff — AU-04 Risk Remediation to Next Workstream

**Date:** 2026-10-10
**Repository:** `E:\fast_sheep`
**Branch:** `main`
**Current HEAD before this handoff commit:** `3caf5d8`
**Environment:** Windows test environment, Node `v24.13.0`, pnpm `10.17.1`

---

## 1. Governance State

Current controller-approved work:

```text
AU-01 Canonical State Reconciliation: PASS / CLOSED
AU-02 Expected Identity Authority Decision: PASS / CLOSED
AU-03 ExecutionIntent Contract: PASS / CLOSED
AU-04 Planning: PASS / CLOSED
AU-04I Contract and Pure Guard: PASS / CLOSED
```

Current pending review:

```text
AU-04S Send-Path Guard Integration: REPAIR_APPLIED_AWAITING_CONTROLLER_REVIEW
```

Current authorization gates:

```text
Transport Integration: NOT_AUTHORIZED
Real Send: NOT_AUTHORIZED
AUTO: NOT_GRANTED
Production Enablement: NOT_AUTHORIZED
AU-05: NOT_AUTHORIZED
```

Do not automatically start AU-05. Wait for Controller `PASS` or `REPAIR`.

---

## 2. What Was Implemented

### AU-01 — Canonical State Reconciliation

- Recorded `SHEEP-312 = PASS / CLOSED`.
- Reconciled canonical phase/milestone pointers to MVP-E.
- Added structured `next_action`.
- Added remediation-program state protection.
- Updated validator and state consistency tests.

### AU-02 — Expected Identity Authority

- Approved decision: `EXPECTED_IDENTITY_AUTHORITY_V1`.
- Defined expected identity as an immutable `ExecutionIntent`.
- Defined actual identity as live Adapter evidence.
- Documented fail-closed rules, freeze points, and invalidation rules.

### AU-03 / AU-04I — ExecutionIntent and Pure Guard

Implemented:

- `ExecutionIntent` contract.
- SHA-256 intent hashing and verification.
- Intent validation and lifecycle transitions.
- `AdapterIdentityEvidence` contract and validator.
- Pure `PreSendGuard.evaluate()` logic.
- Mandatory invocation of `WrongTargetValidator` and `BindingValidator`.
- Full confirmation comparison:
  - `confirmation_id`
  - `confirmation_hash`
  - `confirmed_at`
  - `expires_at`
- Negative tests for identity, plan, policy, session/document, replay, and expiration failures.

### AU-04S — Send-Path Integration

Implemented:

- `ConversationOrchestrator` accepts:
  - `preSendGuard`
  - `preSendGuardRequestFactory`
  - `preSendGuardRequired`
  - `realSendEnabled`
  - `autoEnabled`
- When guard integration is configured, partial configuration fails closed.
- When `realSendEnabled` or `autoEnabled` is true, `preSendGuardRequired=true` is mandatory.
- Missing guard, null request, or denied guard stops before `SendStarted`.
- Guard deny prevents Transport invocation.
- Full guard audit is preserved in decisions and failure events.

Default behavior remains legacy when `preSendGuardRequired=false` and no guard is configured. This preserves existing offline tests; production real-send/AUTO configuration is protected separately by the new configuration gate.

---

## 3. Key Files

### Code

```text
packages/domain/src/execution-intent.ts
packages/domain/src/adapter-identity-evidence.ts
packages/domain/src/index.ts
packages/orchestrator/src/core/pre-send-guard.ts
packages/orchestrator/src/core/conversation-orchestrator.ts
packages/orchestrator/src/index.ts
packages/orchestrator/package.json
```

### Schemas

```text
packages/contracts/schemas/domain/execution-intent.schema.json
packages/contracts/schemas/domain/adapter-identity-evidence.schema.json
resources/contracts/schemas/domain/execution-intent.schema.json
resources/contracts/schemas/domain/adapter-identity-evidence.schema.json
```

### Tests

```text
packages/domain/tests/execution-intent.test.mjs
packages/domain/tests/adapter-identity-evidence.test.mjs
packages/orchestrator/tests/pre-send-guard.test.ts
packages/orchestrator/tests/pre-send-guard-integration.test.ts
tests/contracts/contract-schemas.test.mjs
tests/project-state-consistency.test.mjs
```

### Governance / Reports

```text
project/FAST_SHEEP_RISK_REMEDIATION_ACCEPTANCE_UNITS.md
project/AU-01_CANONICAL_STATE_RECONCILIATION_PLAN.md
project/AU-02_EXPECTED_IDENTITY_AUTHORITY_PLAN.md
project/AU-02_EXPECTED_IDENTITY_AUTHORITY_DECISION_PACKAGE.md
project/AU-03_EXECUTION_INTENT_CONTRACT_PLAN.md
project/AU-04_PRE_SEND_GUARD_PLAN.md
project/AU-04_PRE_SEND_GUARD_DECISION_PACKAGE.md
project/AU-04_PRE_SEND_GUARD_IMPLEMENTATION_ADDENDUM.md
reports/AU-01-canonical-state-reconciliation-report.json
reports/AU-02-expected-identity-authority-report.json
reports/AU-03-execution-intent-contract-report.json
reports/AU-04-pre-send-guard-planning-report.json
reports/AU-04I-pre-send-guard-contract-report.json
reports/AU-04S-pre-send-guard-integration-report.json
```

---

## 4. Verification Commands

Required/relevant commands:

```powershell
pnpm --filter @fastwork/domain run build
pnpm --filter @fastwork/domain run test
pnpm --filter @fastwork/orchestrator run typecheck
pnpm --filter @fastwork/orchestrator run build
node --test packages/orchestrator/tests/pre-send-guard.test.ts packages/orchestrator/tests/pre-send-guard-integration.test.ts
pnpm run typecheck
pnpm run test:contracts
pnpm run validate:contracts
node scripts/validate-project-state.mjs
node --test tests/project-state-consistency.test.mjs
```

Latest target results:

```text
Domain tests: 110/110 PASS
PreSendGuard unit + integration tests: 24/24 PASS
Contract tests: 20/20 PASS
Registered contracts: 63 compiled
Root typecheck: PASS
PROJECT_STATE consistency: PASS
Project-state tests: PASS
```

Known repository-level failures:

```text
Full orchestrator suite: 160/165 pass, 5 existing failures
```

Known failing areas:

```text
tests/conversation-orchestrator-human-confirm.test.ts
tests/orchestrator-golden-fixtures.test.ts
tests/send-failure-classifier.test.ts
tests/send-failure.test.ts
```

These failures are pre-existing and related to source `.js` import resolution, GF-ORCH-008, and send-failure/retry expectations. They are not introduced by the AU-04 Guard tests.

---

## 5. Unresolved Product/Safety Decisions

```text
AD-05 session_generation authoritative producer
AD-06 document_generation authoritative producer
AD-07 Adapter evidence freshness window
AD-08 atomic intent claim owner
```

Do not guess or implement these decisions without Controller/Owner direction.

---

## 6. Important Safety Notes

- No real PDD transport integration was added.
- No real send was enabled.
- No AUTO path was enabled.
- No production enablement was changed.
- No credentials, cookies, tokens, or private user data were introduced.
- Read-only external reference trees were not modified.
- The guard integration is available, but production usage still requires:
  - Adapter evidence producer.
  - product decisions AD-05/06/07.
  - Transport integration authorization.
  - real-send/production authorization.

---

## 7. Next Controller Action

Review AU-04S with:

```text
AU-04S Controller Decision: PASS | REPAIR
```

If `REPAIR`, state the exact failing invariant.

Do not start AU-05 automatically after this handoff.
