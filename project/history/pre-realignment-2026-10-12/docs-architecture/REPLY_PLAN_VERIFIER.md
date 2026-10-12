# ReplyPlan Verifier

> Status: IMPLEMENTED (SHEEP-306)
> Document version: 1.0
> Owner: Fast Sheep architecture authority
> Implementation: `apps/desktop/src/main/services/reply-plan-verifier.ts`
> Related: `REPLY_AND_ACTION_SAFETY.md` §4, `AI_CUSTOMER_SERVICE_CORE.md` §6

This document describes the ReplyPlanVerifier: its purpose, architecture,
verification rules, integration pattern, and MVP simplifications.

---

## 1. Purpose

The ReplyPlanVerifier validates a `ReplyPlan` before execution. It ensures
that the AI-generated reply plan is safe, complete, and based on valid facts.

**Key invariants:**
- Verification is deterministic (no AI-based judgment)
- Verification errors are blocking (prevent execution)
- Verification warnings are informational (do not block)
- Verifier runs in shadow mode (MVP, does not block existing flow)

**Governance basis:**
- Master §5: AI output must be verified before execution
- DEC-SHEEP-306: ReplyPlan verification is structural, not optional
- REPLY_AND_ACTION_SAFETY.md: Verification requirements are explicit

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     ReplyPlanVerifier                        │
│                                                               │
│  Input: ReplyPlan                                            │
│    - plan_id, envelope_ref                                   │
│    - identity_lock                                           │
│    - fact_references                                         │
│    - unknowns                                                │
│                                                               │
│  Output: VerificationResult                                  │
│    - ok (boolean)                                            │
│    - plan_id                                                 │
│    - errors (blocking)                                       │
│    - warnings (non-blocking)                                 │
│    - verified_at (ISO 8601)                                  │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ↓              ↓              ↓
   ┌──────────┐  ┌───────────┐  ┌──────────┐
   │ Identity │  │   Fact    │  │ Unknown  │
   │  Lock    │  │ Freshness │  │  Check   │
   │ Verifier │  │  Verifier │  │          │
   └──────────┘  └───────────┘  └──────────┘
```

### 2.2 Sub-Verifiers

**1. IdentityLock Verifier** (`verifyIdentityLock`)
- Pure function, no side effects
- Validates IdentityLock completeness and validity
- File: `apps/desktop/src/main/services/identity-lock-verifier.ts`

**Validation rules:**
- All required string fields must exist and be non-empty:
  - `merchant_id`, `store_id`, `platform_account_id`
  - `conversation_id`, `trigger_message_id`
- `platform` must be a valid PlatformId:
  - `pdd | doudian | jd | kuaishou | qianniu | xianyu`
- `customer_identity.kind` must be within bounded vocabulary:
  - `customerUid | buyer_id | user_id`
- `customer_identity.value` must be non-empty

**2. Fact Freshness Verifier** (`verifyFactFreshness`)
- Pure function, no side effects
- Validates fact references exist in authoritative_facts
- File: `apps/desktop/src/main/services/fact-freshness-verifier.ts`

**Validation rules:**
- Each `fact_reference.fact_id` must exist in `authoritative_facts`
- `fact_reference.source` must be within bounded vocabulary:
  - `platform_api | merchant_config | store_knowledge | product_knowledge | order_system | logistics_system`
- `fact_key` format must be `<category>.<key>`:
  - Valid categories: `shop_facts | product_facts | order_facts | logistics_facts | knowledge_facts`

**3. Unknown Check** (inline in ReplyPlanVerifier)
- Checks for blocking unknowns in `plan.unknowns`
- Blocking unknowns (`blocking: true`) produce errors
- Non-blocking unknowns produce warnings

### 2.3 Port Interface

```typescript
interface ReplyPlanVerifierPort {
  verify(plan: ReplyPlan): Promise<VerificationResult>;
}

interface VerificationResult {
  readonly ok: boolean;
  readonly plan_id: string;
  readonly errors: readonly VerificationError[];
  readonly warnings: readonly VerificationError[];
  readonly verified_at: string; // ISO 8601
}

interface VerificationError {
  readonly error_id: string;
  readonly category: "identity_lock" | "fact_freshness" | "unknown_blocking" | "policy_violation";
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly blocking: boolean;
}
```

File: `apps/desktop/src/main/ports/reply-plan-verifier-port.ts`

### 2.4 Dependency Injection

Verifier uses constructor injection for facts retrieval:

```typescript
interface ReplyPlanVerifierDeps {
  readonly getFactsForEnvelope: (envelopeRef: string) => Promise<AuthoritativeFacts | undefined>;
}
```

This allows:
- Flexible facts retrieval (cache, database, ContextEnvelope)
- Easy testing with mock facts
- Decoupling from ContextEnvelope storage

---

## 3. Verification Process

The Verifier executes the following steps in order:

1. **Verify IdentityLock**: Call `verifyIdentityLock(plan.identity_lock)`.
   Collects errors for missing/invalid fields.

2. **Retrieve Facts**: Call `deps.getFactsForEnvelope(plan.envelope_ref)`.
   Gets authoritative_facts for fact validation.

3. **Verify Fact Freshness**: Call `verifyFactFreshness(plan, facts)`.
   Collects errors for missing/invalid fact references.

4. **Check Blocking Unknowns**: Filter `plan.unknowns` for `blocking: true`.
   Collects errors for blocking unknowns.

5. **Check Non-Blocking Unknowns**: Filter `plan.unknowns` for `blocking: false`.
   Collects warnings for non-blocking unknowns.

6. **Aggregate Results**: Combine all errors and warnings.
   Set `ok = errors.length === 0`.

7. **Return**: Return `VerificationResult` with `verified_at` timestamp.

---

## 4. Integration

### 4.1 Shadow Mode

Verifier integrates via `ReplyPlanVerificationIntegration` (shadow mode):

```typescript
const integration = createReplyPlanVerificationIntegration({
  builder: contextEnvelopeBuilder,
  verifier: replyPlanVerifier,
  eventSink: (event, payload) => eventBus.emit(event, payload),
  errorLogger: (error, context) => console.error(`[ReplyPlan] ${context}:`, error),
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
- Runs Builder + Verifier in background
- Errors are logged but do not propagate
- Events emitted for diagnostics:
  - `ContextEnvelopeBuilt` (Builder success)
  - `ReplyPlanVerified` (Verifier success)
  - `ReplyPlanVerificationFailed` (Verifier failure)
  - `ReplyPlanBuildOrVerifyFailed` (Builder or Verifier exception)

### 4.2 Mock ReplyPlan

MVP uses Mock ReplyPlan (Worker does not yet generate ReplyPlan):

```typescript
const mockPlan: ReplyPlan = {
  plan_id: randomUUID(),
  envelope_ref: envelope.envelope_id,
  identity_lock: envelope.identity_lock,
  scene: envelope.scene,
  trigger_message: envelope.trigger_message,
  reply_content: { text: "[Mock ReplyPlan]", language: "zh-CN" },
  fact_references: [],
  verification_requirements: { identity_lock_valid: true, facts_validated: true },
  created_at: envelope.created_at,
};
```

**Future (SHEEP-307):** Worker generates real ReplyPlan.

### 4.3 Location

Verifier integration is in **Main process** (`apps/desktop`), not in the
Orchestrator package. This avoids circular dependencies and allows
desktop-specific integration.

---

## 5. Testing

### 5.1 Unit Tests

**IdentityLock Verifier:** `apps/desktop/tests/identity-lock-verifier.test.ts`
- 15 test cases
- Covers all validation rules, valid/invalid platforms, customer identity kinds

**Fact Freshness Verifier:** `apps/desktop/tests/fact-freshness-verifier.test.ts`
- 13 test cases
- Covers fact existence, source validation, key format, categories

**ReplyPlan Verifier:** `apps/desktop/tests/reply-plan-verifier.test.ts`
- 12 test cases
- Covers orchestration, error aggregation, unknown handling, dependency injection

### 5.2 Integration Tests

**File:** `apps/desktop/tests/context-envelope-integration.test.ts`

**Coverage:** 10 test cases (ReplyPlanVerificationIntegration)
- Shadow mode enabled/disabled
- Event emission (success/failure)
- Builder + Verifier integration
- Error handling (never throws)
- Blocking unknowns handling

### 5.3 Test Execution

Tests require Node.js v22+ (`--experimental-strip-types`):

```bash
cd apps/desktop
pnpm run build
node --test tests/identity-lock-verifier.test.ts
node --test tests/fact-freshness-verifier.test.ts
node --test tests/reply-plan-verifier.test.ts
node --test tests/context-envelope-integration.test.ts
```

**Total:** 50 test cases (15 + 13 + 12 + 10)

---

## 6. MVP Simplifications

### 6.1 Shadow Mode Only

Verifier runs in shadow mode. It does not block the existing AI reply flow.

**Rationale:**
- Worker does not yet generate ReplyPlan
- Parallel operation allows safe validation
- Future: Verifier blocks send (Phase 10)

### 6.2 No Timestamp Freshness

Verifier does not validate fact timestamp freshness. It only checks existence.

**Rationale:**
- Timestamp validation requires clock synchronization infrastructure
- MVP facts are retrieved in real-time (freshness not an issue)
- Future: Phase 9 implementation

### 6.3 No Cross-Shop Consistency

Verifier does not validate cross-shop consistency.

**Rationale:**
- Cross-shop validation requires additional context
- MVP is single-shop focused
- Future: Phase 9 implementation

### 6.4 No Value Snapshot Consistency

Verifier does not validate `fact_reference.value_snapshot` consistency.

**Rationale:**
- Snapshot validation requires comparison logic
- MVP does not use value snapshots
- Future: Phase 9 implementation

### 6.5 Mock ReplyPlan

Verifier validates Mock ReplyPlan, not real Worker-generated ReplyPlan.

**Rationale:**
- Worker does not yet generate ReplyPlan
- Mock allows Verifier testing
- Future: SHEEP-307 (Worker generates ReplyPlan)

---

## 7. Error Categories

### 7.1 identity_lock

**Errors:**
- `identity_lock_missing_{field}`: Required field missing or empty
- `identity_lock_invalid_platform`: Platform not in valid vocabulary
- `identity_lock_missing_customer_identity`: customer_identity is undefined
- `identity_lock_invalid_customer_kind`: kind not in valid vocabulary
- `identity_lock_missing_customer_value`: customer_identity.value is empty

**Severity:** All errors are blocking (`severity: "error"`, `blocking: true`)

### 7.2 fact_freshness

**Errors:**
- `fact_missing_{fact_id}`: Fact not found in authoritative_facts
- `fact_invalid_source_{fact_id}`: Source not in valid vocabulary
- `fact_invalid_key_format_{fact_id}`: fact_key format invalid

**Severity:** All errors are blocking (`severity: "error"`, `blocking: true`)

### 7.3 unknown_blocking

**Errors:**
- `blocking_unknowns_detected`: ReplyPlan has blocking unknowns

**Warnings:**
- `unknown_{unknown_id}`: Non-blocking unknown detected

**Severity:** Errors are blocking, warnings are non-blocking

### 7.4 policy_violation

**Status:** Not yet implemented (future work)

**Potential errors:**
- Policy metadata violations
- Rollout mode violations
- Confirmation requirement violations

---

## 8. File Inventory

**Port:**
- `apps/desktop/src/main/ports/reply-plan-verifier-port.ts`

**Services:**
- `apps/desktop/src/main/services/reply-plan-verifier.ts`
- `apps/desktop/src/main/services/identity-lock-verifier.ts`
- `apps/desktop/src/main/services/fact-freshness-verifier.ts`

**Integration:**
- `apps/desktop/src/main/services/reply-plan-verification-integration.ts`

**Tests:**
- `apps/desktop/tests/identity-lock-verifier.test.ts` (15 cases)
- `apps/desktop/tests/fact-freshness-verifier.test.ts` (13 cases)
- `apps/desktop/tests/reply-plan-verifier.test.ts` (12 cases)
- `apps/desktop/tests/context-envelope-integration.test.ts` (10 cases)

---

## 9. Future Work

### Phase 9

- Timestamp freshness validation
- Value snapshot consistency validation
- Cross-shop consistency checks

### Phase 10

- Verifier integrated into Orchestrator core flow
- Verifier blocks send on validation failure
- Real ReplyPlan from Worker (SHEEP-307)

### Future

- Policy violation validation
- Inference confidence validation
- Additional verification categories

---

## 10. References

- Port: `apps/desktop/src/main/ports/reply-plan-verifier-port.ts`
- Schema: `resources/contracts/schemas/domain/reply-plan.schema.json`
- Types: `packages/domain/src/reply-plan.ts`
- Core: `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` §6
- Safety: `docs/architecture/REPLY_AND_ACTION_SAFETY.md` §4
- Evolution: `docs/architecture/REPLY_PLAN_EVOLUTION.md`

---

**Document version:** 1.0
**Created:** 2026-09-29
**Author:** Codex (SHEEP-306 executor)
