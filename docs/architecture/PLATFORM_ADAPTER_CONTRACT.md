# Platform Adapter Contract

> Status: LOCKED ARCHITECTURE AUTHORITY
> Document version: 1.0
> Owner: Fast Sheep architecture authority
> Product authority: `docs/product/FAST_SHEEP_NORTH_STAR.md`
> Current MVP scope: `docs/product/PDD_MVP_V1.md`
> Core flow: `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md`
> Execution safety: `docs/architecture/REPLY_AND_ACTION_SAFETY.md`

This document owns platform-independent adapter semantics. It defines the
product-level boundary between platform capabilities, normalized messages,
identity-locked execution requests, and implementation-private transport
details.

It does not own AI reasoning, deterministic policy, DOM selectors,
WebContentsView mechanics, PDD page internals, or current task state.

---

## 1. Adapter Responsibilities

A platform adapter is the product boundary that translates:

```text
platform-specific reality
<-> normalized Fast Sheep facts and commands
```

The adapter may:

- deliver normalized inbound messages/events
- accept identity-locked send/action requests
- expose declared capabilities
- provide session health and reauthentication state
- optionally provide context reads
- expose a diagnostic/fallback surface boundary
- return typed execution outcomes

The adapter must not decide whether a plan is authorized. Authorization belongs
to deterministic application policy.

---

## 2. Identity Target Boundary

The adapter consumes the canonical IdentityLock defined in
`docs/architecture/AI_CUSTOMER_SERVICE_CORE.md` and maps the identity-locked
execution request into its platform-specific transport target representation.

The adapter owns only:

- consuming an identity-locked execution request
- platform identity mapping
- transport target representation
- platform-specific target requirements

The adapter MUST NOT restate the complete IdentityLock field inventory.

For PDD, the adapter mapping rule is:

```text
platformCustomerId = customerUid
customerUid != conversationId
```

This mapping does not redefine the IdentityLock model.
---

## 3. Normalized Inbound Delivery

The adapter boundary must be able to deliver normalized inbound facts.

A normalized inbound envelope conceptually includes:

- platform
- platform account/session scope
- platform customer identity when known
- internal conversation identity when resolved
- platform message identity when known
- content and content type
- source occurrence time when known
- raw/runtime correlation evidence when safe
- explicit UNKNOWN markers instead of guessed values

Platform-specific payloads, selectors, and authentication/session material
remain behind the adapter boundary.

The core decides when identity is sufficient to create a turn.

---

## 4. Identity-Locked Send Requests

A send request at the adapter boundary conceptually includes:

- IdentityLock
- trigger message binding
- normalized reply content
- verification requirements
- policy decision reference
- attempt identity
- idempotency/attempt correlation

The adapter does not choose the customer or conversation target.

The application layer must verify that the target remains current before the
adapter is called.

---

## 5. Typed Execution Outcomes

Execution outcomes are typed, not boolean-only.

The minimum outcome vocabulary is:

```text
NOT_ATTEMPTED
ACKNOWLEDGED / ACCEPTED
REJECTED
UNKNOWN
```

The adapter may define result payload shape and evidence fields, including:

- platform message ID when known
- source occurrence time when known
- typed source reference when safe

`UNKNOWN` is a typed result value.

The adapter MUST NOT define whether `UNKNOWN` retries, safe retry exceptions,
automatic retry policy, or handoff policy. Those behaviors are owned by
`docs/architecture/REPLY_AND_ACTION_SAFETY.md`.
---

## 6. Capability Declaration

Adapters must declare supported capabilities.

Conceptual capability categories include:

- receive text
- send text
- send media
- conversation selection
- manual takeover detection
- transfer/handoff
- customer context
- product context
- order/logistics context
- session health
- reauthentication

Capabilities are optional unless required by a specific rollout policy.

No platform is required to implement every capability.

Capability declaration is not execution authorization.

---

## 7. Context Reads

Context reads are capability-driven requests.

Possible context domains:

- customer
- product/SKU
- order
- logistics
- conversation
- session health

Context results must be associated with the same IdentityLock and must preserve
provenance.

Missing, stale, or conflicting context is represented as UNKNOWN or a typed
failure. It is not filled by model inference.

---

## 8. Session Health and Reauthentication

The adapter boundary must expose enough state for deterministic policy to
distinguish:

- session ready
- login required
- reauthentication required
- degraded
- disconnected
- restricted
- unknown

The adapter may own transport-specific recovery mechanics, but must not grant
execution authority.

Reauthentication success must produce fresh session evidence before execution
can proceed.

---

## 9. Diagnostic / Fallback Surface

The diagnostic/fallback surface is implementation infrastructure.

Its boundary may expose:

- health
- route/session state
- capability state
- safe diagnostic references
- operator-visible fallback actions

It must not expose credentials, secrets, raw session material, or arbitrary
DOM/JavaScript execution.

The diagnostic surface is not the primary product experience.

---

## 10. Transport Encapsulation

For MVP, the `PlatformAdapter` implementation may encapsulate its current
transport mechanism.

For PDD today, the embedded runtime is an internal adapter implementation
detail.

Implementation-private details include:

- DOM selectors
- WebContentsView
- preload/page bridge messages
- route interception
- fixture mechanics
- official API payloads
- future browser/runtime mechanics

A separate mandatory transport-strategy abstraction is NOT introduced by this
document.

A separate strategy may be extracted only when a real second transport exists
or evidence proves the need.

---

## 11. Isolation and Routing

Adapter selection must be explicit by platform and runtime scope.

Requests routed to one shop/session must not execute through another
shop/session adapter.

Cross-shop and cross-account routing is deny-by-default.

The adapter contract must expose enough identity evidence for deterministic
pre-send and post-execution verification.

---

## 12. Relationship to Existing Code

Current executable boundaries include:

- `packages/orchestrator/src/ports/platform-adapter.ts`
- `packages/platform-web-common/src/adapter-factory.ts`
- `packages/platform-pdd/src/pdd-platform-adapter.ts`
- `packages/platform-pdd/src/page/page-runtime.ts`
- `packages/platform-pdd/src/send-text-semantics.ts`
- `packages/persistence/src/delivery/delivery-attempt.ts`

These are current implementation foundations. Their exact method signatures may
evolve only through governed implementation work.

This document does not add methods or runtime behavior.

---

## 13. Ownership Boundaries

- Product identity: `docs/product/FAST_SHEEP_NORTH_STAR.md`
- Current PDD MVP scope and RolloutMode: `docs/product/PDD_MVP_V1.md`
- Core lifecycle: `docs/architecture/AI_CUSTOMER_SERVICE_CORE.md`
- Execution safety: `docs/architecture/REPLY_AND_ACTION_SAFETY.md`
- Constitution: `project/FAST_SHEEP_MASTER_PROMPT.md`

This document must not duplicate AI reasoning rules, policy decisions,
RolloutMode definitions, or current authorization state.