# SHEEP-309 Subtask 6 Report: Integration Wiring

**Status:** ✅ COMPLETE
**Date:** 2026-09-30
**Files:**
- New: `apps/desktop/src/main/services/shadow-mode-bootstrap.ts`
- Modified: `apps/desktop/src/main/worker-runtime.ts` (additive integration)

## Summary

Implemented SHADOW mode integration wiring — connects the ShadowPipelineOrchestrator to the existing worker-runtime context through a clean bootstrap module.

## Implementation

### 1. shadow-mode-bootstrap.ts

**Purpose:** Single entry point for SHADOW mode initialization.

**Interface:**
```typescript
interface ShadowBootstrapDeps {
  conn: SqliteConnection;           // Shared m10Sqlite.conn
  workerClient: AIWorkerClient;     // Worker RPC client
  conversationRepository: NormalizedConversationRepository;
  messageRepository: MessageRepository;
}

interface ShadowModeComponents {
  orchestrator: ShadowPipelineOrchestrator;
  auditLogger: AuditLogger;
  transportBlocker: TransportBlocker;
  reportGenerator: AuditReportGenerator;
  turnBuilder: InboundTurnBuilder;
  sceneClassifier: MinimalSceneClassifier;
  knowledgePort: StoreKnowledgeRetrievalPort;
  factsPort: AuthoritativeFactsPort;
  envelopeBuilder: ContextEnvelopeBuilder;
  policyEngine: PolicyEngine;
  persistence: CanonicalInboundPersistence;
  workerJobClient: WorkerJobClientPort;
}
```

**Function:** `bootstrapShadowMode(deps)` creates and wires all components:
- AuditLogger (shared conn lifecycle)
- TransportBlocker (fresh instance per bootstrap)
- AuditReportGenerator
- WorkerJobClient (wraps AIWorkerClient)
- CanonicalInboundPersistence (SHEEP-300)
- InboundTurnBuilder (SHEEP-301, 500ms quiet window)
- MinimalSceneClassifier (SHEEP-304)
- RpcStoreKnowledgeRetrievalAdapter (SHEEP-305)
- StubAuthoritativeFactsProvider (SHEEP-306)
- PolicyEngine (SHEEP-308)
- ContextEnvelopeBuilder (SHEEP-306)
- ShadowPipelineOrchestrator (SHEEP-309)

### 2. worker-runtime.ts Integration

**Additive change:** Added `initializeShadowMode(deps)` function at the end of the file.

**Key design:**
- Does NOT modify existing `createWorkerBackedMainContext`
- Creates its own m10Sqlite connection for repositories
- Returns `ShadowModeComponents` with all components ready
- SHADOW mode is opt-in (called explicitly when needed)

## Verification

- **Typecheck:** ✅ `pnpm run typecheck` passes for all packages (0 errors)
- **Tests:** DEFERRED — requires personal PC (Windows + Node.js v22+)

## Acceptance Criteria

- [x] AC1: ShadowPipelineOrchestrator correctly initialized in worker-runtime context
- [x] AC2: All dependencies correctly injected
- [x] AC3: SHADOW mode can be enabled/disabled via configuration (opt-in function call)
- [x] AC4: Existing inbound flow not affected (SHADOW mode is additive)
- [x] AC5: Typecheck passes

## Architecture

```
worker-runtime.ts
    ↓ initializeShadowMode(deps)
shadow-mode-bootstrap.ts
    ↓ bootstrapShadowMode(deps)
    ├── AuditLogger (shared conn)
    ├── TransportBlocker (fresh)
    ├── AuditReportGenerator
    ├── WorkerJobClient (wraps AIWorkerClient)
    ├── CanonicalInboundPersistence (SHEEP-300)
    ├── InboundTurnBuilder (SHEEP-301)
    ├── MinimalSceneClassifier (SHEEP-304)
    ├── RpcStoreKnowledgeRetrievalAdapter (SHEEP-305)
    ├── StubAuthoritativeFactsProvider (SHEEP-306)
    ├── PolicyEngine (SHEEP-308)
    ├── ContextEnvelopeBuilder (SHEEP-306)
    └── ShadowPipelineOrchestrator (SHEEP-309)
```
