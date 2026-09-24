# FAST_SHEEP_CODING_ROADMAP_V1.1_REVIEWED.md

# 快羊客服 AI-First Coding Roadmap — Reviewed V1.1

> **Project root**: `E:\fast_sheep\`
> **Document Version**: V1.1_REVIEWED
> **Status**: REVIEWED / CURRENT EXECUTION AUTHORITY
> **Supersedes as current execution authority**: `project/FAST_SHEEP_CODING_ROADMAP_V1.0_REVIEWED.md`
> **Historical V1.0 authority**: `project/FAST_SHEEP_CODING_ROADMAP_V1.0_REVIEWED.md`
> **Execution authorization**: NONE for `SHEEP-300`
> **Current first candidate**: `SHEEP-300`
> **Next stage executed**: NO

V1.0 remains immutable historical reviewed governance. This V1.1 document
supersedes V1.0 only as the current execution-order authority.

---

# 0. Authority and Historical Policy

The canonical execution order is now:

`SHEEP-090` completed history
-> `SHEEP-091..SHEEP-281` deferred historical V1.0 work
-> `SHEEP-300+` current AI-first MVP execution

## Completed History

Completed history through `SHEEP-090` remains closed and must not be reopened
merely because this Roadmap changes future execution order.

### SHEEP-090 — Historical Completion Boundary (Reference Only)

This heading is a historical boundary marker. It does not reopen or redefine
`SHEEP-090`.

## Deferred Historical V1.0 Work

All unfinished V1.0 task definitions and IDs remain preserved.

`SHEEP-091` through `SHEEP-281` are classified as:

`DEFERRED_HISTORICAL_V1_0`

They are not:

- CANCELLED
- SKIPPED
- CLOSED
- renumbered
- redefined
- reused

A future task may consume a V1.0 task by explicit reference, but it must not
silently reuse its ID.

`SHEEP-091` remains:

`NOT_STARTED / PAUSED / DEFERRED_HISTORICAL_V1_0`

---

# 1. Milestone Model

V1.1 is organized by customer-value milestone:

| Milestone | Meaning | Tasks |
|---|---|---|
| `MVP-A FOUNDATION` | Identity, inbound, persistence, aggregation, scene, context, plan, policy foundation | `SHEEP-300` through `SHEEP-308` |
| `MVP-B SHADOW` | Real controlled PDD inbound through AI ReplyPlan and audit, with no platform send | `SHEEP-309` |
| `MVP-C HUMAN_CONFIRM` | Safe human-confirmed PDD send and verification | `SHEEP-310` through `SHEEP-311` |
| `MVP-D AUTO` | Separate production authorization after deterministic safety validation | `SHEEP-312` |
| `MVP-E MULTI_SHOP_EXPANSION` | Two-shop and broader isolation proof | `SHEEP-313` |

The conceptual order is mandatory:

`MVP-A -> MVP-B -> MVP-C -> MVP-D -> MVP-E`

Completing an implementation task does not automatically authorize the next
milestone or production execution.

---

# 2. Product Alignment Guard

Every proposed implementation task must state:

```text
PRODUCT_ALIGNMENT:
CURRENT_MVP_RELEVANCE:
CUSTOMER_VALUE:
SAFETY_IMPACT:
OUT_OF_SCOPE:
DECISION:
```

Allowed `DECISION`:

- `PROCEED`
- `PRODUCT_DIRECTION_MISMATCH`

Raw PDD UI polishing is out of scope unless explicitly authorized
diagnostic/fallback work or required to remove a transport/runtime blocker.

---

# 3. Current MVP Constraints

- First real rollout: one controlled PDD shop.
- Architecture: multi-shop ready.
- First scene: `SHIPPING_TIME`.
- Second scene: `OPEN_DECISION`.
- `LOGISTICS`: recommendation only.
- SHIPPING_TIME rule: merchant-configured Store Knowledge (DEC-008 aligned).
- Product/SKU context is deferred unless the approved SHIPPING_TIME rule needs
  product-level exceptions.
- Scene model initially: `SHIPPING_TIME`, `OTHER/UNSUPPORTED`, `UNKNOWN`.
- `ConversationOrchestrator.performSend()` automatic retry conflict:
  `RECORDED_IMPLEMENTATION_GAP / BLOCKING_PRODUCTION_AUTO`.
- AUTO requires separate Controller production authorization.

---

# 4. MVP-A FOUNDATION

## M-A.1 Identity and Inbound Foundation

### SHEEP-300 — IdentityLock and Inbound Envelope Contract

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Materialize the canonical inbound IdentityLock and Inbound Envelope
contract.

**Dependencies:** Package 2 architecture authorities.

**Allowed scope:** Contracts/domain types and focused validation only.

**Must not:** wire production PDD, call AI, send messages, persist production
data, implement aggregation, or implement scene classification.

**Exit criteria:**

- platform is explicit
- runtime shop binding identity is explicit when applicable
- canonical merchant/store/platform-account scope is authoritative value or
  explicit `UNKNOWN/UNRESOLVED`
- PDD platform customer identity is `customerUid`
- internal conversation identity remains distinct from `customerUid`
- authoritative platform inbound message identity is represented when known
- source content/time is represented
- runtime/session/document-generation evidence is representable where applicable
- unknown/unresolved identity is explicit
- runtime `ShopRecord` is not automatically equated with canonical `Store` or
  `PlatformAccount`
- focused contract tests pass

**Customer value:** trustworthy inbound identity foundation.

**Safety value:** prevents wrong shop/customer/conversation binding.

---

### SHEEP-301 — PDD Inbound Producer Mapping

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Map the real PDD inbound observation path into the canonical Inbound
Envelope.

**Dependencies:** `SHEEP-300`.

**Allowed scope:** PDD adapter/page-event mapping and focused tests only.

**Must not:** call AI, send messages, or implement aggregation/scene/context.

**Exit criteria:**

- controlled fixture maps platform, shop binding, customerUid, message ID,
  conversation identity, content, and source time
- incomplete identity remains explicit
- no cross-shop mapping
- no production send path is invoked

**Customer value:** reliable capture of inbound customer messages.

**Safety value:** prevents identity substitution at the producer boundary.

---

### SHEEP-302 — Durable Normalized Inbound Persistence

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Persist normalized inbound messages through the Main mutation boundary.

**Dependencies:** `SHEEP-301`; existing persistence repositories.

**Allowed scope:** Main ingestion, persistence mapping, and focused tests.

**Must not:** call AI, send, aggregate multiple messages, or classify scenes.

**Exit criteria:**

- normalized inbound message is durable
- source/observed time semantics remain explicit
- dedupe/idempotency behavior is defined for the accepted producer boundary
- unknown facts remain unknown
- cross-shop leakage tests pass

**Customer value:** messages are not lost across runtime interruptions.

**Safety value:** durable evidence and correct scope before AI processing.

---

### SHEEP-303 — Inbound Aggregation / Turn Builder

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Aggregate consecutive inbound messages for approximately 3–5 seconds
inside one IdentityLock and create one AI turn.

**Dependencies:** `SHEEP-302`.

**Allowed scope:** in-memory aggregation/turn-building logic and focused tests.

**Must not:** classify scenes, retrieve facts, call AI, or send.

**Exit criteria:**

- quiet-window behavior is deterministic and testable
- source-message order is preserved
- no aggregation across merchant/store/platform account/customer/conversation
- stale or changed IdentityLock cannot merge into an existing turn

**Customer value:** fewer fragmented replies and better multi-question answers.

**Safety value:** prevents mixed-context AI turns.

---

## M-A.2 Scene and Context Foundation

### SHEEP-304 — Minimal Scene Contract

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Create `MINIMAL_V1` scene classification for `SHIPPING_TIME`,
`OTHER/UNSUPPORTED`, and `UNKNOWN`.

**Dependencies:** `SHEEP-303`.

**Allowed scope:** scene contract and deterministic classifier boundary.

**Must not:** build a broad intent taxonomy or implement the second scene.

**Exit criteria:**

- result vocabulary is bounded
- unsupported and unknown remain safe paths
- classifier cannot trigger send
- second scene remains `OPEN_DECISION`

**Customer value:** correct routing for the first supported scene.

**Safety value:** unsupported questions do not receive fabricated automation.

---

### SHEEP-305 — Minimal Store Knowledge Pipeline for SHIPPING_TIME

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Architecture realignment:** This task now aligns with DEC-008 (Layered Knowledge Architecture) and PDD_MVP_V1 §6 (Knowledge V1). SHIPPING_TIME rules are Store Knowledge, not a standalone fact provider.

**Goal:** Build a minimal knowledge retrieval pipeline that supports importing and retrieving Store Knowledge (including SHIPPING_TIME rules) for AI reply generation.

**Dependencies:** `SHEEP-304`; existing persistence infrastructure.

**Allowed scope:**
- Knowledge schema (Store Knowledge type, including SHIPPING_TIME rules)
- Simple import interface (merchant fills in text rules)
- Simple retrieval (keyword matching + template rendering)
- AI can retrieve and use knowledge to generate replies
- Focused tests for schema, import, retrieval, and AI integration

**Must not:**
- Implement full vector retrieval (deferred to Phase 9)
- Implement learning model (deferred to Phase 9)
- Implement complex conflict resolution (deferred to Phase 9)
- Invent dispatch SLA, payment-time rule, product exception, or region exception semantics
- Enable send

**Exit criteria:**
- Store Knowledge schema supports SHIPPING_TIME rules as a knowledge type
- Merchant can configure SHIPPING_TIME rules via simple text input
- Rules are persisted as Store Knowledge with proper merchant/store scope
- AI can retrieve relevant knowledge when generating SHIPPING_TIME replies
- Keyword-based retrieval returns correct knowledge for given query
- Unknown/unresolved knowledge remains explicit
- No send is possible
- Focused tests pass

**Customer value:** AI can answer SHIPPING_TIME questions using merchant-configured rules.

**Safety value:** Knowledge is merchant-scoped and authoritative; no guessed facts.

**Phase 9 extension path:** This minimal pipeline will be extended in Phase 9 (Knowledge/RAG/Learning) to full vector retrieval, automatic learning, and complex conflict resolution. The schema and import interface remain compatible.

---

### SHEEP-306 — ContextEnvelope and ReplyPlan Contract Evolution

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Evolve the existing Suggestion/SendRequest direction into the
governed ContextEnvelope + ReplyPlan contract.

**Dependencies:** `SHEEP-305`.

**Allowed scope:** contracts/types and migration tests only.

**Must not:** add a second competing reply model, call AI, or send.

**Exit criteria:**

- ReplyPlan retains identity lock, trigger message, scene, reply content,
  fact/knowledge references, policy metadata, and verification requirements
- authoritative facts, supporting knowledge, inference, and unknown remain
  distinct
- existing Suggestion/SendRequest evolution path is explicit
- no duplicate canonical model exists

**Customer value:** grounded and verifiable reply proposals.

**Safety value:** fact/inference boundary is structural.

---

## M-A.3 AI and Policy Foundation

### SHEEP-307 — AI Worker Structured ReplyPlan Integration

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Adapt the AI Worker request/response boundary to consume identity and
ContextEnvelope and return a structured ReplyPlan.

**Dependencies:** `SHEEP-306`.

**Allowed scope:** Main/Worker integration, schemas, deterministic provider
tests, and structured-plan tests.

**Must not:** send messages or grant execution authority.

**Exit criteria:**

- worker receives identity-scoped context
- worker returns structured ReplyPlan
- no free-form reply bypasses plan validation
- plan remains proposal-only
- deterministic test path does not call transport

**Customer value:** AI generates usable, context-aware reply plans.

**Safety value:** AI output cannot directly execute.

---

### SHEEP-308 — Deterministic Policy and RolloutMode Gate

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Implement deterministic policy evaluation and RolloutMode resolution
for `OFF`, `SHADOW`, `HUMAN_CONFIRM`, and `AUTO`.

**Dependencies:** `SHEEP-307`; canonical RolloutMode definitions in
`docs/product/PDD_MVP_V1.md`.

**Allowed scope:** policy engine, mode resolution, typed decisions, and focused
negative tests.

**Must not:** authorize AUTO, send messages, or grant production execution.

**Exit criteria:**

- policy evaluates IdentityLock, scope, facts, capability, entitlement, risk,
  side-effect class, and session health
- `SHADOW` cannot call transport
- `HUMAN_CONFIRM` requires confirmation
- `AUTO` remains capability-gated and externally unauthorized
- AI confidence cannot satisfy authorization

**Customer value:** safe configurable rollout behavior.

**Safety value:** deterministic execution authority.

---

# 5. MVP-B SHADOW

### SHEEP-309 — SHADOW End-to-End Audit

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Prove the real controlled PDD inbound path through IdentityLock,
durable message, aggregation, minimal scene, ContextEnvelope, AI ReplyPlan,
deterministic policy, and persistent audit.

**Dependencies:** `SHEEP-302` through `SHEEP-308`.

**Allowed scope:** SHADOW execution, audit persistence, and controlled-shop
validation only.

**Must not:** call platform transport or send any message.

**Exit criteria:**

- real controlled PDD inbound is observed
- durable normalized inbound message exists
- one AI turn is built from the aggregation window
- scene result is recorded
- authoritative facts/knowledge provenance is recorded
- ReplyPlan is recorded
- policy result is recorded
- `TRANSPORT SEND CALLS = 0`
- persistent audit correlation is complete

**Customer value:** measurable AI reply quality without customer side effects.

**Safety value:** validates the full loop before first production send.

---

# 6. MVP-C HUMAN_CONFIRM

### SHEEP-310 — Retry Conflict and Wrong-Target Gate

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Resolve the `ConversationOrchestrator.performSend()` automatic-retry
conflict and implement deterministic pre-send wrong-target validation.

**Dependencies:** `SHEEP-309`.

**Allowed scope:** orchestrator retry behavior, pre-send validation, and
negative tests.

**Must not:** authorize AUTO or broaden transport.

**Exit criteria:**

- attempted/UNKNOWN/side-effect-possible failures never auto-retry
- safe pre-attempt behavior is explicit and policy-gated
- customerUid is independently checked from conversationId
- shop/platform account/conversation/trigger/session/document bindings are
  validated before send
- stale selection and cross-shop execution are rejected
- adversarial wrong-target tests pass

**Customer value:** prevents duplicate or misdirected messages.

**Safety value:** removes the known production AUTO blocker.

---

### SHEEP-311 — HUMAN_CONFIRM PDD Transport and Verification

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Enable controlled human-confirmed PDD sending for one shop.

**Dependencies:** `SHEEP-310`; transport/session readiness.

**Allowed scope:** single controlled-shop PDD send, confirmation binding, typed
outcome, verification, audit, and desktop notification.

**Must not:** enable AUTO or implement business actions.

**Exit criteria:**

- human confirmation binds to exact ReplyPlan/version/IdentityLock
- transport produces typed `ACKNOWLEDGED`, `REJECTED`, or `UNKNOWN`
- verification is recorded
- UNKNOWN reason is recorded and surfaced
- desktop notification is delivered
- audit correlation is complete
- AUTO remains disabled

**Customer value:** safe assisted reply automation.

**Safety value:** human remains the execution gate.

---

# 7. MVP-D AUTO

### SHEEP-312 — AUTO Safety and Adversarial Validation

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Validate all deterministic prerequisites for AUTO.

**Dependencies:** `SHEEP-311`.

**Allowed scope:** AUTO policy validation, adversarial tests, audit, and
production-authorization package preparation.

**Must not:** grant production authorization or execute business ActionPlans.

**Exit criteria:**

- IdentityLock validation is deterministic
- wrong-target gate covers shop/customer/conversation/session/document
- attempted/UNKNOWN never auto-retries
- typed UNKNOWN handling and escalation are proven
- result verification and persistent audit are complete
- cross-shop/account adversarial tests pass
- AUTO production authorization package is ready for separate Controller review
- AUTO production authorization remains `NOT_GRANTED`

**Customer value:** safely lower required human effort.

**Safety value:** AUTO cannot become authorized through implementation alone.

---

# 8. MVP-E MULTI_SHOP_EXPANSION

### SHEEP-313 — Multi-Shop Expansion Proof

**Status:** `NOT_STARTED / NOT_AUTHORIZED`

**Goal:** Prove isolation before broader multi-shop rollout.

**Dependencies:** `SHEEP-312`.

**Allowed scope:** second-shop test runtime, isolation tests, recovery tests,
and governance evidence.

**Must not:** treat one-shop success as multi-shop proof.

**Exit criteria:**

- two shops run concurrently
- conversation/customer isolation passes
- knowledge/RAG isolation passes
- send isolation passes
- audit/handoff isolation passes
- failure/recovery isolation passes
- configuration isolation passes
- cross-merchant/store adversarial tests pass

**Customer value:** scalable shop operation.

**Safety value:** tenant isolation is proven, not inferred.

---

# 9. Gates

## GATE-MVP-A-FOUNDATION

PASS requires:

- SHEEP-300 through SHEEP-308 complete
- IdentityLock and inbound envelope exist
- PDD inbound mapping and durable persistence pass
- aggregation and minimal scene pass
- SHIPPING_TIME rule decision is closed before fact implementation
- ContextEnvelope and ReplyPlan are canonical
- Worker integration is proposal-only
- deterministic policy and RolloutMode gate pass

## GATE-MVP-B-SHADOW

PASS requires:

- SHADOW end-to-end path passes
- persistent audit passes
- `TRANSPORT SEND CALLS = 0`

## GATE-MVP-C-HUMAN_CONFIRM

PASS requires:

- retry conflict resolved
- wrong-target gate passes
- human confirmation binding exists
- typed outcomes and verification pass
- desktop notification and audit pass
- controlled one-shop send passes
- AUTO remains disabled

## GATE-MVP-D-AUTO

PASS requires:

- AUTO implementation prerequisites complete
- adversarial wrong-target and isolation tests pass
- persistent audit and escalation pass
- separate Controller production authorization is recorded
- implementation completion alone does not grant AUTO

## GATE-MVP-E-MULTI_SHOP

PASS requires:

- two-shop concurrency
- isolation and adversarial tests across all core stores
- recovery and configuration isolation
- no cross-merchant/store leakage

---

# 10. Backlog / Historical References

The following remain deferred and are not current V1.1 execution tasks:

- V1.0 unfinished task IDs `SHEEP-091` through `SHEEP-281`
- DouDian parity
- generic action/tool expansion
- learning/publishing
- cloud foundation
- subscription/commercial control
- sync/team collaboration
- release/RC
- non-MVP PDD UI/context work

V1.1 may reference these ranges without copying or redefining their bodies.

---

# 11. Current Execution State

`SHEEP-300` is the next authoritative task candidate.

Current status:

`NOT_STARTED / NOT_AUTHORIZED`

No implementation, live, send, or AUTO authorization is granted by this
Roadmap.

The external Controller must review this migration before `SHEEP-300` can be
executed.
