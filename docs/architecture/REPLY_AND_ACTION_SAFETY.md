# Reply and Action Safety

> Status: LOCKED ARCHITECTURE AUTHORITY
> Document version: 1.0
> Owner: Fast Sheep architecture authority
> Product safety authority: `docs/product/FAST_SHEEP_NORTH_STAR.md`
> Current MVP scope and RolloutMode: `docs/product/PDD_MVP_V1.md`
> Core flow: `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md`
> Adapter semantics: `docs/architecture/PLATFORM_ADAPTER_CONTRACT.md`

This document owns deterministic execution safety for replies and future
actions: IdentityLock validation, wrong-target defense, fact validation,
UNKNOWN/retry semantics, confirmation and handoff requirements, and audit
requirements.

It does not own product identity, RolloutMode definitions, PDD scene scope,
transport implementation, or current authorization state.

---

## 1. Safety Invariant

Execution authorization is deterministic application logic.

The required order is:

```text
AI proposal
-> IdentityLock validation
-> fact validation
-> deterministic policy decision
-> explicit authorization
-> transport execution
-> result verification
-> audit
-> human escalation if required
```

AI confidence alone never grants execution permission.

---

## 2. IdentityLock Gate

Before any reply or action executes, deterministic code validates the canonical
IdentityLock defined in `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md`.

This document owns IdentityLock validation only. It MUST NOT restate the
canonical IdentityLock field inventory.

Validation categories include:

- business/store/account scope still matches
- platform customer target still matches
- conversation/trigger binding remains current
- runtime/session/document state remains current
- stale-selection conditions are rejected
- cross-shop/account execution is rejected

For PDD, `customerUid` is independently validated from `conversationId`.

A missing, conflicting, stale, or unresolved required identity fact is not
guessed. It blocks execution or forces handoff.
---

## 3. Wrong-Target Pre-Send Gate

Before AUTO send, deterministic verification must establish:

- intended business/store/platform-account scope
- intended customer platform identity
- internal conversation identity
- trigger message binding
- current runtime/session identity
- current document generation
- selected-customer binding when required
- stale-selection rejection
- cross-shop/account rejection

The gate must reject execution when any required binding cannot be proven.

One correct send is not evidence that future target binding is safe.

---

## 4. Fact Validation

Authoritative facts are hard inputs.

The policy must distinguish:

- authoritative business facts
- retrieved supporting knowledge
- AI inference
- UNKNOWN

AI inference must not silently become an authoritative fact.

If required deterministic facts are missing, contradictory, stale, or
unverified, the execution path must degrade safely.

---

## 5. Deterministic Policy Inputs

Policy conceptually evaluates:

- current RolloutMode
- IdentityLock validity
- shop/resource scope
- authoritative facts
- platform capability
- entitlement
- risk
- side-effect authorization
- transport/session health

The detailed meanings of OFF, SHADOW, HUMAN_CONFIRM, and AUTO are owned by
`docs/product/PDD_MVP_V1.md`. This document references that model but does not
redefine it.

Policy output must be explicit and auditable.

---

## 6. Attempt and UNKNOWN Semantics

Execution states must distinguish:

```text
SAFE PRE-ATTEMPT
AUTHORITATIVELY NOT_ATTEMPTED
ATTEMPTED
ACKNOWLEDGED
REJECTED
UNKNOWN
```

No automatic retry is allowed after an execution attempt when a platform side
effect cannot be ruled out.

A safe pre-attempt or authoritatively `NOT_ATTEMPTED` failure may become
retryable only under a future explicit policy.

An `UNKNOWN` outcome must:

- stop automatic execution
- preserve reason/context for audit
- surface the case to a human

---

## 7. Current Implementation Gap

Current implementation gap:

`E:\fast_sheep\packages\orchestrator\src\core\conversation-orchestrator.ts`
currently retries a failed send once in `performSend()`.

That behavior conflicts with the no-automatic-retry rule when the first attempt
may have caused a platform side effect.

This is an implementation gap to reconcile before production AUTO.

No code change is authorized by this document.

---

## 8. Confirmation

Human confirmation may be required before execution for the applicable
RolloutMode or deterministic policy reason.

Human confirmation must bind to:

- IdentityLock
- ReplyPlan/ActionPlan
- target resource
- policy version
- current session evidence

A confirmation for one target or plan must not authorize a different target or
a later plan.

The exact UI and persistence model is future work.

---

## 9. Human Handoff

Handoff is required when deterministic policy cannot safely proceed.

Handoff reasons include:

- UNKNOWN
- unsupported case
- insufficient authoritative knowledge
- high-risk or unsafe case
- transport/runtime uncertainty
- explicit policy handoff

V1 notification target is desktop notification. Persistent confirmation queue
and notification implementation remain future work.

---

## 10. ActionPlan Safety

ActionPlan is a future extension.

Lifecycle:

```text
AI proposes ActionPlan
-> deterministic validation
-> policy/risk/entitlement gate
-> confirmation when required
-> deterministic execution
-> result verification
-> audit
```

AI never directly executes a platform side effect.

Current PDD reply MVP does not implement:

- refund
- cancel order
- modify address
- reshipment
- after-sales business actions

---

## 11. Audit Requirements

Every consequential decision must be traceable through:

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

Audit must preserve identity scope and correlation references without copying
unnecessary customer content.

Existing delivery attempts and normalized messages are reusable foundations.

---

## 12. Multi-Shop AUTO Precondition

Multi-shop AUTO is not considered safe until:

- production orchestration is isolated per shop or proven safe
- worker requests carry merchant/store/platform-account identity
- knowledge/context is shop-scoped
- audit and handoff records are shop-scoped
- wrong-target defense passes adversarial cross-shop tests

One-shop success does not prove multi-shop isolation.

---

## 13. Ownership Boundaries

- Global safety hierarchy: `docs/product/FAST_SHEEP_NORTH_STAR.md`
- RolloutMode definitions: `docs/product/PDD_MVP_V1.md`
- Core lifecycle: `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md`
- Adapter boundary: `docs/architecture/PLATFORM_ADAPTER_CONTRACT.md`
- Constitution: `project/FAST_SHEEP_MASTER_PROMPT.md`
- Current state/authorization: `project/PROJECT_STATE.json`

This document must not duplicate RolloutMode definitions, product identity, or
current task status.