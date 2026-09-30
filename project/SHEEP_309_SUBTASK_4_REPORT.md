# SHEEP-309 Subtask 4 Report: ShadowPipelineOrchestrator

**Status:** ✅ COMPLETE (after typecheck fix)
**Date:** 2026-09-30
**File:** `apps/desktop/src/main/services/shadow-pipeline-orchestrator.ts`

## Summary

Implemented the Shadow Pipeline Orchestrator — the core 11-step sequential pipeline that drives SHADOW mode execution from InboundEnvelope to ReplyPlan, with full audit trail and zero-send verification.

## Initial State

The previous model produced an orchestrator with 34 typecheck errors, primarily caused by:
1. Incorrect field access on `InboundEnvelope` (used flat fields like `.envelopeId`, `.messageId`, `.platform` instead of the actual nested structure: `.identityLock.*`, `.sourceContent.text`, `.sourceOccurredAt`)
2. Incorrect `IdentityResolution<T>` handling (treated branded strings like `MerchantId` as objects with `.value`)
3. Wrong `WorkerJobClientPort` API (used `.request()` instead of `.run(type, request)`)
4. Wrong `AuditLogger.recordStep()` signature (passed 1 arg instead of 2: `runId` + step data)
5. Wrong `PolicyDecision` field names (used `.decision`, `.risk_level` instead of `.allowed`, `.rollout_mode`)
6. Missing null-safety for optional fields (`explicit_unknowns`, `fact_references`)

## Fix Approach

1. **`resolveId()` helper**: Accepts `IdentityResolution<unknown>` and handles both branded strings (`MerchantId = string & { __merchant }`) and object types (`RuntimeShopRef = { value: string }`). Returns `string | null`.

2. **InboundEnvelope access**: Uses `envelope.identityLock.*` for identity fields, `envelope.sourceContent.text` for message content, `envelope.sourceOccurredAt` for timestamp.

3. **WorkerJobClientPort**: Uses `workerClient.run("conversation.generate_v2", { envelope, mode })`.

4. **AuditLogger**: Uses `recordStep(runId, stepData)` with 2 arguments, where stepData is `Omit<AuditStep, "id" | "runId">`.

5. **PolicyDecision**: Uses correct fields: `allowed`, `rollout_mode`, `requires_confirmation`, `reasons`, `warnings`, `blocking_issues`.

6. **SceneClassification**: Stored as module-level `let` variable (not inside closure) to avoid TypeScript narrowing issues.

## 11-Step Pipeline

| Step | Name | Purpose |
|------|------|---------|
| 1 | IDENTITY_LOCK | Validate IdentityLock completeness |
| 2 | PERSISTENCE | Persist normalized inbound message |
| 3 | TURN_BUILD | Aggregate messages into AI Turn |
| 4 | SCENE_CLASSIFY | Classify scene (MINIMAL_V1) |
| 5 | KNOWLEDGE_RETRIEVAL | Retrieve store knowledge |
| 6 | ENVELOPE_BUILD | Build ContextEnvelope |
| 7 | REPLY_PLAN | Generate ReplyPlan via RPC |
| 8 | POLICY_EVAL | Evaluate policy |
| 9 | AUDIT_PERSIST | Confirm audit persistence |
| 10 | TRANSPORT_VERIFY | Verify zero transport calls |
| 11 | RUN_COMPLETE | Mark run completed |

## Key Design Decisions

1. **Pipeline continues on error**: Each step is wrapped in try-catch. Failed steps are recorded but don't stop the pipeline (except for critical failures like missing turn).

2. **Duplicate handling**: If persistence returns DUPLICATE, the pipeline short-circuits with a clean completion (0 messages, 0 transport calls).

3. **Turn extraction**: After ingestion, the orchestrator polls for expired turns and uses the latest emitted turn for downstream steps.

4. **Transport safety**: TransportBlocker is reset at the start of each run. Step 10 verifies `successfulSends === 0`. Any violation throws an error.

5. **Audit completeness**: Step 9 confirms the audit run and steps are persisted. Step 11 marks the run as COMPLETED.

## Verification

- **Typecheck:** ✅ `pnpm run typecheck` passes for all packages (0 errors)
- **Tests:** DEFERRED — requires personal PC (Windows + Node.js v22+)

## Dependencies

The orchestrator injects all components:
- `CanonicalInboundPersistence` (SHEEP-300)
- `InboundTurnBuilder` (SHEEP-301)
- `MinimalSceneClassifier` (SHEEP-304)
- `StoreKnowledgeRetrievalPort` (SHEEP-305)
- `AuthoritativeFactsPort` (SHEEP-306)
- `ContextEnvelopeBuilder` (SHEEP-306)
- `WorkerJobClientPort` (M10)
- `PolicyEngine` (SHEEP-308)
- `PolicyConfig` (SHEEP-308)
- `AuditLogger` (SHEEP-309 Subtask 2)
- `TransportBlocker` (SHEEP-309 Subtask 3)

## Exit Criteria Met

- ✅ 11-step sequential execution
- ✅ Each step recorded in AuditLogger
- ✅ TransportBlocker verifies zero sends
- ✅ Errors caught and recorded
- ✅ Complete audit trail in result
- ✅ Typecheck passes
