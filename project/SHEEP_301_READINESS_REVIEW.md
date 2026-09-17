# SHEEP-301 Readiness Review — Bounded Main-Local Fixture Mapping

> Status: CONTROLLER PASS / BOUNDED IMPLEMENTATION AUTHORIZATION RECORDED  
> Date: 2026-09-17  
> Audit baseline: `79faea827fb6100a2860757ff61e838dbf9ac70a`  
> Controller decision: `PASS`  
> Scope: controlled Main-local raw-ingress fixture mapping acceptance unit only  
> Implementation state: `NOT_STARTED`  
> This review record does not replace product, architecture, decisions, or execution-state authority.

---

## 1. Authorization Decision

Controller accepted the repaired readiness audit and authorized only a bounded implementation acceptance unit:

`MAIN_LOCAL_RAW_INGRESS_BOUND_CONTROLLED_FIXTURE_MAPPING`

This authorization:

- permits future implementation work only after a separate Controller implementation-task prompt;
- does not close SHEEP-301;
- does not authorize production PDD ingestion;
- does not authorize SHEEP-302 or later tasks;
- does not authorize live, send, HUMAN_CONFIRM, AUTO, persistence, or platform mutation.

The Codex audit result is `COMPLETE`; the Controller readiness decision is `PASS`.

---

## 2. Approved Bounded Path

```text
controlled Main-local fixture
-> document-bound trusted Main binding
-> raw PDD payload semantic validation
-> explicit incomplete-identity handling
-> canonical IdentityLock / InboundEnvelope
-> canonical schema validation
-> controlled result or test collector
-> STOP
```

This path must not connect to:

- the existing DOM `message_received` -> legacy AI bridge;
- a new production IPC receive ingress;
- Titan or WebSocket production receive;
- AI Worker generation;
- persistence;
- transport send.

The input uses historical PDD payload semantics. Connection to a future real producer remains a separate integration review item.

---

## 3. Main Binding and Document Scope

A trusted Main binding must be established for each valid ingress context.

The binding must include:

- the actual sender `webContents`;
- the actual `PddSessionHost` instance;
- runtime shop;
- current live document generation;
- evidence that the session/view is still alive and owns the binding.

Required behavior:

- a WebContents reload from generation 1 to generation 2 leaves the old generation-1 observation invalid;
- a missing observation-time document fact cannot be repaired at receive time;
- disposal and recreation of a session invalidates the old context even if shop/session strings and generation number repeat;
- a missing, fabricated, or mismatched document context is rejected;
- all asynchronous gaps must revalidate liveness and binding before canonical output;
- legacy fixture tolerance for missing document generation must not be reused.

---

## 4. Input, Direction, and Identity

Initial direction evidence comes from confirmed PDD semantics:

- `from.role = user`;
- `to.role = mall_cs`.

The historical raw payload has no separate direction field; absence of such a field must not itself reject a payload.

Rejection is required when:

- direction cannot be determined;
- roles are invalid;
- an explicit direction contradicts sender/recipient semantics;
- sender/shop/session authority conflicts;
- field format is present but invalid and would otherwise be silently converted;
- payload-declared canonical IDs are being used to establish Main authority.

Incomplete identity rules:

- missing `customerUid` may map to `platformCustomerId = UNKNOWN`;
- missing `msg_id` may map to `platformMessageIdentity = UNKNOWN`;
- missing both identity facts may still produce an explicitly incomplete canonical result only when the trusted inbound payload is otherwise valid;
- invalid field format is distinct from absence;
- `UNRESOLVED` means evidence exists but canonical binding is incomplete, not a bypass for conflicts;
- unknown canonical Store, PlatformAccount, internal conversation, or local message identity remains explicit;
- selected customer is independent runtime evidence and never fills `platformCustomerId`;
- opaque values and provenance are preserved without string-prefix guessing.

---

## 5. Main Gate

The recommended implementation must provide a complete gate, not an isolated mapper helper.

Required checks:

| Condition | Result |
|---|---|
| Sender is not trusted | Reject |
| Trusted sender belongs to another shop/session | Reject |
| Session does not exist | Reject |
| Session/view is disposed or no longer owns the binding | Reject |
| Document generation is missing, stale, or mismatched | Reject |
| Direction is outbound or unknown | Reject |
| Payload format is invalid | Reject |
| Canonical schema validator is unavailable or rejects output | Fail closed |
| Session host rejects the event | Stop before mapper and downstream |
| No canonical collector is configured | Stop; do not use default AI bridge |
| Any mapper exception occurs | Stop; do not use default AI bridge |

A sender-to-session/shop/document reverse binding is required. Type assertions or payload-reported shop/session values are not authority.

---

## 6. Canonical Mapping

Only the existing SHEEP-300 contracts may be used:

- `IdentityLock`
- `InboundEnvelope`
- `IdentityResolution`
- `PlatformMessageIdentity`

No second canonical inbound model may be introduced.

Field behavior:

| Field | Rule |
|---|---|
| `platform` | Trusted PDD value `pdd`; wrong/missing value rejects |
| `runtimeShop` | Resolve only from trusted Main binding; otherwise `UNKNOWN` |
| `merchantId` | Resolve only from trusted Main merchant context |
| `storeId` | Resolve only from an authoritative Store mapping; otherwise `UNKNOWN` |
| `platformAccountId` | Resolve from trusted local PlatformAccount binding; seller `externalRef` is separate and optional |
| `platformCustomerId` | Resolve only from trusted per-message PDD sender evidence |
| `internalConversationId` | Resolve only from trusted canonical conversation binding |
| `runtimeConversationReference` | May resolve independently as a runtime-only reference when trusted |
| `triggerMessage.localMessageId` | Resolve only from a Main-created/resolved local message ID |
| `triggerMessage.platformMessageIdentity` | Preserve `AUTHORITATIVE_PLATFORM_ID`, `LOCAL_FINGERPRINT`, `SYNTHETIC`, or `UNKNOWN` provenance |
| `runtimeEvidence.sessionId` | Copy only from the Main sender/session binding |
| `runtimeEvidence.documentGeneration` | Copy only when it matches the live accepted generation |
| `runtimeEvidence.selectedCustomerObservation` | Independent evidence only; never a message sender substitute |

`UNKNOWN` means no usable identity evidence is available.  
`UNRESOLVED` means candidate evidence exists but canonical binding is incomplete or conflicting.  
`RESOLVED` requires both trusted evidence and a satisfied canonical binding condition.

No generic blacklist applies to opaque resolved values such as `"0"`, `"unknown"`, `"null"`, or `"placeholder"`. A producer-invented value is invalid because of provenance, not because of its string shape.

---

## 7. Content and Source Time

### Content

The selected raw ingress path must preserve:

- leading and trailing whitespace;
- content longer than 4000 characters;
- the source text exactly as received.

If an upstream legacy path already trimmed or truncated content, the mapper must not claim that exact content was recovered. It must return a limited/non-success result or stop.

`sourceContent.kind` remains `text`.

### Source time

`sourceOccurredAt` is part of SHEEP-301.

- A valid trusted platform/source time is mapped.
- Missing source time maps to `null`.
- Invalid or semantically unverified source time maps to `null`.
- The adapter records `SOURCE_TIME_MISSING` or `SOURCE_TIME_INVALID` in its diagnostic/result, not in the canonical envelope.
- `Date.now()` and local observed time are forbidden substitutes.
- Strict date, time, and timezone semantics must be validated; the shared validator prefix is not sufficient.
- Local `observedAt` and durable persistence remain SHEEP-302.

A null `sourceOccurredAt` or unknown external conversation reference is not automatically a universal SHADOW hard block. The specific downstream capability that requires the missing fact must fail closed or hand off later.

---

## 8. Deduplication and Stop Boundary

The recommended fixture ingress bypasses:

- `PddPageRuntime`;
- `lastConversationId`;
- the current pre-mapper `MessageDeduplicator`.

This is required so messages with the same platform message ID in different conversations can both reach canonical output.

SHEEP-301 must not claim that legacy DOM dedup is repaired.

Durable deduplication and persistence remain SHEEP-302. If a future path uses the legacy DOM runtime, dedup scope must be corrected before canonical mapping and is not deferrable.

All branches must stop without falling back to `PddOrchestratorBridge`:

- success;
- validation failure;
- missing collector;
- schema failure;
- mapper exception.

Required zero-side-effect assertions:

- AI calls = 0;
- transport send calls = 0;
- persistence writes = 0.

---

## 9. Candidate Implementation Files

### PDD adapter and mapper

- `E:\fast_sheep\packages\platform-pdd\src\inbound-normalizer.ts`
- new narrow mapper module under `E:\fast_sheep\packages\platform-pdd\src\`
- package exports in `E:\fast_sheep\packages\platform-pdd\src\index.ts`
- workspace dependency declarations only if required by the implementation

### Main ingress and session lifecycle

- `E:\fast_sheep\apps\desktop\src\main\platforms\pdd\pdd-platform-service.ts`
- `E:\fast_sheep\apps\desktop\src\main\platforms\pdd\pdd-session-host.ts`
- `E:\fast_sheep\apps\desktop\src\main\index.ts` only if required to preserve sender binding for the accepted local path
- `E:\fast_sheep\apps\desktop\src\main\bootstrap.ts` only if required to inject the controlled fixture collector or trusted binding

Do not automatically authorize production wiring merely because a file appears in this candidate list.

### Contract impact

The recommended Main-local raw ingress does not require:

- changes to `E:\fast_sheep\packages\contracts\schemas\platform\pdd-page-event.schema.json`;
- changes to `E:\fast_sheep\packages\contracts\src\generated\platform-pdd.ts`;
- a new production IPC channel.

If the implementation instead reuses the DOM page-event path, then page-event schema semantics, generated mirror, pre-mapper dedup, and sender/session binding must be addressed explicitly in SHEEP-301.

---

## 10. Focused Acceptance Matrix

| ID | Scenario | Required result |
|---|---|---|
| A1 | Complete trusted payload and binding | One valid canonical `InboundEnvelope` |
| A2 | Missing `customerUid` | `platformCustomerId = UNKNOWN`; no fabricated value |
| A3 | Missing `msg_id` | `platformMessageIdentity = UNKNOWN`; no fallback upgrade |
| A4 | Trusted literal opaque value such as `unknown` | Preserved if provenance is trusted |
| A5 | Two shops | No cross-shop binding or output |
| A6 | Reload generation 1 -> generation 2 | Old generation-1 observation rejected |
| A7 | Dispose and recreate session | Old context rejected despite equal shop/session/generation strings |
| A8 | Missing or forged document context | Rejected |
| A9 | Invalid roles or contradictory direction | Rejected |
| A10 | Conflicting trusted identity binding | Rejected; no `UNRESOLVED` bypass |
| A11 | Selected customer observation | Never substitutes for message sender identity |
| A12 | Same message ID in two conversations | Both reach canonical output on selected path |
| A13 | Content with surrounding whitespace | Preserved exactly |
| A14 | Content over 4000 characters | Preserved exactly |
| A15 | Valid source time | Mapped with validated source semantics |
| A16 | Missing source time | `sourceOccurredAt = null` with reason |
| A17 | Invalid source time | `sourceOccurredAt = null` with reason; no local-time fallback |
| A18 | Canonical validator unavailable/invalid | Fail closed |
| A19 | Success, failure, missing collector, mapper exception | AI = 0, transport send = 0, persistence writes = 0 |

These are implementation acceptance requirements, not claims that work has completed.

---

## 11. Readiness Status

This record authorizes bounded fixture implementation readiness only.

Remaining readiness work before implementation:

- implement the Main sender/document binding;
- implement explicit incomplete-identity handling;
- implement and validate the canonical mapper;
- prove the stop boundary and zero-side-effect invariants;
- satisfy A1-A19.

Not connected or not authorized:

- future real PDD producer;
- Titan/WebSocket transport;
- production IPC ingestion;
- durable persistence and dedup;
- AI generation;
- SHADOW;
- HUMAN_CONFIRM;
- AUTO;
- transport send;
- platform mutation.

Completion of this bounded acceptance unit will not close the full SHEEP-301 task and will not authorize SHEEP-302.