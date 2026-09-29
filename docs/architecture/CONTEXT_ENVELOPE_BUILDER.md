# ContextEnvelope Builder

> Status: IMPLEMENTED (SHEEP-306)
> Document version: 1.0
> Owner: Fast Sheep architecture authority
> Implementation: `apps/desktop/src/main/services/context-envelope-builder.ts`
> Related: `REPLY_PLAN_EVOLUTION.md`, `AI_CUSTOMER_SERVICE_CORE.md` §5

This document describes the ContextEnvelopeBuilder: its purpose, architecture,
dependencies, integration pattern, and MVP simplifications.

---

## 1. Purpose

The ContextEnvelopeBuilder constructs a `ContextEnvelope` (Format C) from
an `InboundTurn` and related context. It is the core component that bridges
the existing inbound processing flow with the future AI input format.

**Key invariants:**
- Builder is deterministic (no AI involvement)
- Builder output is a complete, identity-scoped AI input
- Builder runs in shadow mode (does not block existing flow)
- Builder failures are logged but do not affect AI reply generation

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    ContextEnvelopeBuilder                     │
│                                                               │
│  Input: ContextEnvelopeBuildInput                            │
│    - InboundTurn (identity_lock, messages, timestamps)       │
│    - SceneMessageFact[] (message text, sender role)          │
│    - productId? (optional product context)                   │
│                                                               │
│  Output: ContextEnvelope                                     │
│    - envelope_id, conversation_id                            │
│    - identity_lock (ContractIdentityLock)                    │
│    - scene (classified scene)                                │
│    - trigger_message                                         │
│    - authoritative_facts                                     │
│    - retrieved_knowledge                                     │
│    - explicit_unknowns                                       │
│    - created_at                                              │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ↓              ↓              ↓              ↓
   ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐
   │  Scene   │  │ Knowledge │  │  Facts   │  │ Unknown  │
   │Classifier│  │ Retrieval │  │   Port   │  │Identifier│
   └──────────┘  └───────────┘  └──────────┘  └──────────┘
```

### 2.2 Sub-Components

**1. MinimalSceneClassifier**
- Deterministic scene classification (keyword matching, rule-based)
- Output: `SceneClassification` (scene, reason, rule_id, diagnostics)
- Bounded vocabulary: MINIMAL_V1 contract
- File: `apps/desktop/src/main/services/minimal-scene-classifier.ts`

**2. StoreKnowledgeRetrievalPort**
- Retrieves store-level knowledge (shipping policy, return policy, FAQ)
- Port interface allows multiple implementations (RPC, stub, mock)
- Output: `StoreKnowledgeQueryResult` (knowledge items with relevance scores)
- File: `apps/desktop/src/main/ports/store-knowledge-retrieval-port.ts`

**3. AuthoritativeFactsPort**
- Gathers authoritative facts from database (shop, product, order, logistics)
- Facts have provenance (source, confidence = 1.0)
- Port interface allows multiple implementations
- File: `apps/desktop/src/main/ports/authoritative-facts-port.ts`

**4. UnknownIdentifier**
- Identifies missing or incomplete information
- Marks explicit unknowns with `blocking: true/false`
- Blocking unknowns prevent execution (future)
- File: `apps/desktop/src/main/services/unknown-identifier.ts`

### 2.3 Dependency Injection

Builder uses constructor injection for all dependencies:

```typescript
interface ContextEnvelopeBuilderDeps {
  readonly sceneClassifier: MinimalSceneClassifier;
  readonly knowledgeRetrieval: StoreKnowledgeRetrievalPort;
  readonly factsPort: AuthoritativeFactsPort;
  readonly clock?: Clock; // Optional, defaults to SystemClock
}
```

This allows:
- Easy testing with mock dependencies
- Flexible deployment (stub vs real implementations)
- Deterministic testing with injectable clock

---

## 3. Build Process

The Builder executes the following steps in order:

1. **Map IdentityLock**: Convert `InboundTurn.identity_lock` (Domain Layer)
   to `ContractIdentityLock` (Contract Schema). This is an explicit mapping
   because the two layers use different naming conventions.

2. **Classify Scene**: Run `MinimalSceneClassifier.classify()` on message facts.
   Output determines which scene-specific logic applies.

3. **Gather Authoritative Facts**: Call `AuthoritativeFactsPort.gather()` with
   identity_lock context. Returns facts from database with provenance.

4. **Retrieve Knowledge**: Call `StoreKnowledgeRetrievalPort.query()` with
   scene and message context. Returns knowledge items with relevance scores.

5. **Identify Unknowns**: Run `UnknownIdentifier.identify()` on gathered data.
   Marks missing facts, unresolved identity, etc.

6. **Assemble Envelope**: Combine all components into `ContextEnvelope`.

7. **Return**: Return completed envelope with `envelope_id`, `created_at`, etc.

---

## 4. Integration

### 4.1 Shadow Mode

Builder integrates via `ContextEnvelopeIntegration` (shadow mode):

```typescript
const integration = createContextEnvelopeIntegration({
  builder: contextEnvelopeBuilder,
  eventSink: (event, payload) => eventBus.emit(event, payload),
  errorLogger: (error, context) => console.error(`[ContextEnvelope] ${context}:`, error),
});

// In message handler:
integration.runShadowMode({
  turn: inboundTurn,
  messageFacts: sceneMessageFacts,
  productId: extractedProductId,
});
```

**Shadow mode characteristics:**
- Fire-and-forget (no await, no blocking)
- Errors are logged but do not propagate
- Events emitted for diagnostics: `ContextEnvelopeBuilt`, `ContextEnvelopeBuildFailed`
- Does not modify existing AI reply flow

### 4.2 Location

Builder integration is in **Main process** (`apps/desktop`), not in the
Orchestrator package (`packages/orchestrator`). This avoids circular dependencies:
- Orchestrator is a shared package
- Builder depends on desktop-specific ports/adapters
- Integration happens where both are available

---

## 5. Testing

### 5.1 Unit Tests

**File:** `apps/desktop/tests/context-envelope-builder.test.ts`

**Coverage:** 7 test cases
- Complete envelope construction
- IdentityLock mapping
- Knowledge retrieval (success/failure)
- Clock injection
- Scene classification propagation

### 5.2 Integration Tests

**File:** `apps/desktop/tests/context-envelope-integration.test.ts`

**Coverage:** 6 test cases (ContextEnvelopeIntegration)
- Shadow mode enabled/disabled
- Event emission (success/failure)
- Error handling (never throws)

### 5.3 Test Execution

Tests require Node.js v22+ (`--experimental-strip-types`):

```bash
cd apps/desktop
pnpm run build
node --test tests/context-envelope-builder.test.ts
```

---

## 6. MVP Simplifications

### 6.1 Shadow Mode Only

Builder runs in shadow mode. It does not replace Format A
(ConversationEngineRequest) in the production AI reply flow.

**Rationale:**
- Worker still expects Format A
- Parallel operation allows safe validation
- Future: Worker accepts Format C (SHEEP-307)

### 6.2 No Order/Logistics Facts

`AuthoritativeFactsPort` currently returns only shop_facts and product_facts.
Order_facts and logistics_facts are not yet implemented (MVP scope).

**Rationale:**
- Order/logistics integration requires additional infrastructure
- MVP focuses on basic Q&A scenarios
- Future: Phase 9 implementation

### 6.3 Stub Knowledge Retrieval

`StoreKnowledgeRetrievalPort` currently uses a stub implementation.
Real RAG retrieval is not yet integrated.

**Rationale:**
- RAG pipeline is separate work (SHEEP-305)
- Stub allows Builder testing without RAG dependency
- Future: Integrate real RAG pipeline

---

## 7. File Inventory

**Service:**
- `apps/desktop/src/main/services/context-envelope-builder.ts`

**Ports:**
- `apps/desktop/src/main/ports/store-knowledge-retrieval-port.ts`
- `apps/desktop/src/main/ports/authoritative-facts-port.ts`

**Adapters:**
- `apps/desktop/src/main/adapters/rpc-store-knowledge-retrieval.ts`
- `apps/desktop/src/main/adapters/stub-authoritative-facts.ts`

**Integration:**
- `apps/desktop/src/main/services/context-envelope-integration.ts`
- `apps/desktop/src/main/services/scene-envelope-adapter.ts`

**Supporting:**
- `apps/desktop/src/main/services/minimal-scene-classifier.ts`
- `apps/desktop/src/main/services/unknown-identifier.ts`

**Tests:**
- `apps/desktop/tests/context-envelope-builder.test.ts` (7 cases)
- `apps/desktop/tests/context-envelope-integration.test.ts` (6 cases)

---

## 8. Future Work

### Phase 3 (SHEEP-307)

- Worker accepts ContextEnvelope as input
- Builder output sent to Worker (Format C)
- Format A remains as fallback during transition

### Phase 9

- Order/logistics facts implementation
- Real RAG knowledge retrieval integration
- Full fact freshness validation (timestamps)

### Phase 10

- Builder integrated into Orchestrator core flow
- Format C becomes primary AI input
- Format A deprecated

---

## 9. References

- Schema: `resources/contracts/schemas/domain/context-envelope.schema.json`
- Types: `packages/domain/src/context-envelope.ts`
- Core: `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` §5
- Evolution: `docs/architecture/REPLY_PLAN_EVOLUTION.md`
- Safety: `docs/architecture/REPLY_AND_ACTION_SAFETY.md` §4

---

**Document version:** 1.0
**Created:** 2026-09-29
**Author:** Codex (SHEEP-306 executor)
