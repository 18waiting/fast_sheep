# AI Customer Service Core

> Status: LOCKED ARCHITECTURE AUTHORITY
> Document version: 1.0
> Owner: Fast Sheep architecture authority
> Product authority: `docs/product/FAST_SHEEP_NORTH_STAR.md`
> Current MVP scope: `docs/product/PDD_MVP_V1.md`
> Adapter semantics: `docs/architecture/PLATFORM_ADAPTER_CONTRACT.md`
> Execution safety: `docs/architecture/REPLY_AND_ACTION_SAFETY.md`

This document owns the AI-first customer-service core loop, identity/context/turn
lifecycle, ReplyPlan/ActionPlan boundary, Main/Worker responsibility boundary,
and cross-cutting correlation points.

It does not own product identity, RolloutMode definitions, PDD implementation
details, current task state, or constitutional security rules.

---

## 1. Core Loop

The target architecture flow is:

```text
Normalized inbound
-> IdentityLock
-> aggregation / turn creation
-> scene classification
-> ContextEnvelope
-> authoritative facts / knowledge
-> AI generation
-> ReplyPlan
-> deterministic policy
-> execution
-> verification
-> persistent audit
-> human escalation if required
```

The loop is intentionally split between:

- deterministic identity, scope, policy, transport, and verification logic
- AI reasoning and plan proposal
- audit and human escalation

AI output is a plan. It is not execution authority.

---

## 2. IdentityLock

An IdentityLock is the immutable identity scope for a reply or action.

Conceptually it binds:

- merchant identity
- store identity
- platform-account identity
- platform
- platform customer identity
- internal conversation identity
- triggering inbound message identity
- runtime/session/document generation evidence when applicable

For PDD, the platform customer identity is `customerUid`.

`customerUid` MUST NOT be renamed to `conversationId`, substituted by
`conversationId`, or treated as the same fact.

If a legacy runtime `ShopRecord` identity is needed, it is a runtime binding
identity only. It MUST NOT be silently equated with the canonical domain
`Store` identity.

An IdentityLock is valid only while all required target facts and applicable
runtime evidence remain valid.

---

## 3. Inbound Aggregation and Turn Creation

The core may aggregate consecutive inbound customer messages for approximately
3-5 seconds before creating an AI turn. Exact timing and flush rules remain
implementation decisions.

Aggregation is allowed only within the same IdentityLock scope.

Never aggregate across:

- merchant
- store
- platform account
- customer
- conversation

Source-message order must be preserved.

If identity scope is incomplete, unknown, changed, or stale, the core must
fail closed or explicitly degrade rather than crossing scope.

---

## 4. Turn Lifecycle

A turn is created from an identity-locked aggregation set.

Minimum conceptual turn correlation:

```text
turn_id
identity_lock
source_message_ids
created_at
scene
context_envelope
plan_id
policy_decision_id
execution_id
audit_id
```

The exact persistence model is future work. Correlation semantics are required
even when individual IDs are not yet implemented.

A new inbound event may invalidate an unfinished plan. Stale plan results must
not execute against a newer turn or a different identity scope.

---

## 5. ContextEnvelope

The ContextEnvelope is the bounded, identity-scoped input to AI generation.

It may contain:

- authoritative shop facts
- authoritative product/SKU facts
- authoritative order/logistics facts
- authoritative policy/knowledge facts
- retrieved supporting knowledge
- conversation context
- explicit unknowns

Facts must carry provenance sufficient to distinguish:

1. authoritative business facts
2. retrieved supporting knowledge
3. AI inference

AI inference MUST NOT silently become an authoritative fact.

Knowledge and context must be shop-scoped before multi-shop AUTO.

### 5.1 Implementation Status (SHEEP-306 ✅)

**Schema defined:** `packages/domain/src/context-envelope.ts`

**TypeScript types** mirror JSON Schema definitions in
`resources/contracts/schemas/domain/context-envelope.schema.json`.
Contract Schema types use flat strings with snake_case naming (JSON-compatible).

**Builder implemented:** `apps/desktop/src/main/services/context-envelope-builder.ts`

The ContextEnvelopeBuilder orchestrates:
1. IdentityLock mapping (InboundTurn → ContractIdentityLock)
2. Scene classification (MinimalSceneClassifier)
3. Authoritative fact gathering (AuthoritativeFactsPort)
4. Knowledge retrieval (StoreKnowledgeRetrievalPort)
5. Explicit unknown identification (UnknownIdentifier)

**Integration:** Shadow-mode integration in Main process
(`apps/desktop/src/main/services/context-envelope-integration.ts`).
Builder runs alongside existing AI reply flow without blocking it.

**Testing:** 7 test cases in `apps/desktop/tests/context-envelope-builder.test.ts`.

**MVP simplifications:**
- Builder runs in shadow mode (does not replace Format A)
- Worker still receives Format A (ConversationEngineRequest)
- Format C (ContextEnvelope) is constructed but not yet used for generation

---

## 6. ReplyPlan

`ReplyPlan` is the governed evolution/replacement direction of the existing
`Suggestion` and `SendRequest` structures.

It is not a second competing reply model. A future contract migration may
extend or supersede the current structures.

A ReplyPlan conceptually requires:

- IdentityLock
- triggering inbound message binding
- scene
- reply content
- authoritative fact/knowledge references
- policy-relevant metadata
- verification requirements

The architecture must preserve the current single-source principle: the
canonical reply proposal model evolves; it is not duplicated.

### 6.1 Implementation Status (SHEEP-306 ✅)

**Schema defined:** `packages/domain/src/reply-plan.ts`

**TypeScript types** mirror JSON Schema definitions in
`resources/contracts/schemas/domain/reply-plan.schema.json`.

**Verifier implemented:** `apps/desktop/src/main/services/reply-plan-verifier.ts`

The ReplyPlanVerifier orchestrates pre-execution verification:
1. IdentityLock completeness and validity (`verifyIdentityLock`)
2. Fact reference existence and source validation (`verifyFactFreshness`)
3. Blocking unknown detection
4. Error/warning aggregation

**Integration:** Shadow-mode verification in Main process
(`apps/desktop/src/main/services/reply-plan-verification-integration.ts`).
Verifier runs alongside existing AI reply flow without blocking it.

**Testing:** 40 test cases across verifier test files:
- `identity-lock-verifier.test.ts` (15 cases)
- `fact-freshness-verifier.test.ts` (13 cases)
- `reply-plan-verifier.test.ts` (12 cases)

**MVP simplifications:**
- Verifier runs in shadow mode (does not block send)
- Mock ReplyPlan used (Worker does not yet generate ReplyPlan)
- No timestamp freshness validation (Phase 9 future work)
- No cross-shop consistency checks (Phase 9 future work)

**Future (Phase 3 / SHEEP-307):**
- Worker accepts ContextEnvelope as input
- Worker generates real ReplyPlan (replaces Mock)
- Verifier validates real ReplyPlan before execution

---

## 7. ActionPlan

`ActionPlan` is a future extension for business actions.

AI may propose an ActionPlan. AI never directly executes a platform side effect.
Deterministic application code executes approved actions.

The current PDD reply MVP does not implement:

- refund
- cancel order
- modify address
- reshipment
- after-sales business actions

Business actions remain outside current reply-MVP implementation scope.

---

## 8. Main / Worker Responsibility Boundary

Main owns:

- identity resolution and IdentityLock construction
- deterministic policy evaluation
- entitlement/capability/resource-scope checks
- transport selection and execution
- result verification
- persistent audit
- human escalation routing

The AI Worker owns:

- retrieval and reasoning
- scene classification support
- ReplyPlan/ActionPlan proposal
- evidence and provenance references

The Worker does not own:

- execution authorization
- platform transport internals
- target identity mutation
- retry authorization
- audit truth

The Renderer does not own any of the above. It consumes typed projections and
sends typed user intents through the approved Preload/IPC boundary.

---

## 9. Deterministic Policy Boundary

Execution authorization is deterministic application logic.

Policy conceptually evaluates:

- current RolloutMode
- IdentityLock validity
- merchant/store/resource scope
- authoritative facts
- platform capability
- entitlement
- risk
- side-effect authorization
- transport/session health

RolloutMode definitions are owned by
`docs/product/PDD_MVP_V1.md`. This document references the concept but does not
redefine it.

AI confidence alone never grants execution permission.

Detailed execution safety semantics are owned by
`docs/architecture/REPLY_AND_ACTION_SAFETY.md`.

---

## 10. Execution and Verification

A policy-authorized plan is passed to the platform adapter boundary.

The adapter hides transport implementation details.

The application layer must preserve:

- exact target identity
- trigger-message correlation
- plan/version correlation
- attempt identity
- typed outcome
- verification result
- unknown reason when applicable

A transport/action UNKNOWN outcome follows the Safety-managed terminal or
escalation path in docs/architecture/REPLY_AND_ACTION_SAFETY.md.

Retry policy is not defined by the AI Core document.

---

## 11. Audit Correlation

The architecture requires durable correlation from:

```text
InboundMessage
-> AI turn
-> ReplyPlan
-> policy decision
-> delivery/send attempt
-> transport outcome
-> platform message ID if known
-> UNKNOWN reason if applicable
-> human escalation
```

Existing `normalized_messages` and `delivery_attempts` are reusable foundations.

Exact table names, event taxonomy, retention, and deletion policy remain future
governed work.

---

## 12. Human Escalation

Human escalation is a first-class output of the core loop.

Escalation may be required for:

- UNKNOWN
- unsupported case
- insufficient authoritative knowledge
- high-risk or unsafe case
- transport/runtime uncertainty
- explicit handoff policy

V1 notification target is desktop notification. Persistent confirmation queue
and notification implementation remain future work.

---

## 13. Multi-Shop AUTO Precondition

The architecture is multi-shop ready, but one-shop success does not prove
multi-shop isolation.

Production AUTO across multiple shops is not considered safe until:

- the shared ConversationOrchestrator risk is resolved or proven safe
- worker requests carry merchant/store/platform-account identity
- knowledge/context is shop-scoped
- audit and handoff records are shop-scoped
- cross-shop adversarial isolation tests pass

Until then, multi-shop AUTO is not authorized.

---

## 14. Ownership Boundaries

- Product identity: `docs/product/FAST_SHEEP_NORTH_STAR.md`
- Current PDD MVP scope and RolloutMode: `docs/product/PDD_MVP_V1.md`
- Adapter semantics: `docs/architecture/PLATFORM_ADAPTER_CONTRACT.md`
- Execution safety: `docs/architecture/REPLY_AND_ACTION_SAFETY.md`
- Locked decisions: `project/DECISIONS.md`
- Current execution state: `project/PROJECT_STATE.json`

Do not duplicate these bodies in this document.