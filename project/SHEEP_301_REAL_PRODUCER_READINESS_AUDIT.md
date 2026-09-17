# SHEEP-301 — Remaining Real-Producer Integration Readiness Audit

> Task: SHEEP-301
> Acceptance Unit: REMAINING_REAL_PRODUCER_INTEGRATION_READINESS_AUDIT
> Mode: READ-ONLY IMPLEMENTATION READINESS AUDIT
> Baseline: e82dd4ca46a61aa2148ed693039fad6c325b0a4b
> Audit result: COMPLETE
> Implementation readiness recommendation: BLOCKED
> Controller review status: AWAITING_CONTROLLER_REVIEW

This audit records evidence and a proposed direction only. It does not authorize or perform product implementation, production wiring, live PDD validation, AI, persistence, send, or platform action. The full SHEEP-301 task remains PARTIAL / OPEN.

---

## 1. Product and Safety Preflight

- PRODUCT_ALIGNMENT: trusted inbound identity and canonical delivery remain the current MVP foundation.
- CURRENT_MVP_RELEVANCE: HIGH.
- CUSTOMER_VALUE: reliable capture of actual customer messages without identity substitution or silent loss.
- SAFETY_IMPACT: HIGH.
- OUT_OF_SCOPE: product/source changes, production IPC/Titan/WebSocket wiring, live validation, AI, persistence, send, platform business action, and SHEEP-302 or later.
- DECISION: PROCEED.
- CANONICAL_AUTHORITY_READ: AGENTS.md authority order, PROJECT_STATE, the accepted bounded review/report, and the canonical IdentityLock/InboundEnvelope contracts.
- IDENTITY_SCOPE: runtime shop/session/view/document generation plus canonical merchant/store/account/customer/conversation/message associations.
- SIDE_EFFECT_CLASS: repository-read-only analysis; audit artifacts only.
- UNKNOWN_BEHAVIOR: UNKNOWN/UNRESOLVED is preserved; no display-name, selected-customer, or coincident-string substitution.
- ROLLBACK_OR_STOP_CONDITION: stop on any requirement to modify product code/tests/schema/governance, observe live PDD/network data, or open a forbidden side-effect path.

---

## 2. Confirmed State

- SHEEP-300 is CLOSED.
- MAIN_LOCAL_RAW_INGRESS_BOUND_CONTROLLED_FIXTURE_MAPPING is IMPLEMENTED / COMPLETE / CONTROLLER PASS.
- Full SHEEP-301 is PARTIAL / OPEN.
- last_closed_task remains SHEEP-300.
- next_authoritative_roadmap_id remains SHEEP-301.
- execution, live evidence, send, persistence, HUMAN_CONFIRM, AUTO, platform mutation, and later-task gates remain closed.

---

## 3. Source Inventory

| Source | Role | Classification | Evidence |
|---|---|---|---|
| packages/platform-pdd/src/inbound-normalizer.ts | Raw payload normalizer and canonical-ingress normalizer | CONFIRMED | Defines observed raw fields and rejects present-but-invalid identity values while preserving missing/unknown facts. |
| packages/platform-pdd/src/inbound-to-canonical.ts | Pure canonical mapper | CONFIRMED | Builds immutable IdentityLock / InboundEnvelope with no AI, persistence, send, or side effect. |
| apps/desktop/src/main/platforms/pdd/pdd-inbound-ingress.ts | Accepted Main canonical gate | CONFIRMED | Resolves Main scope/identity, checks association ownership, validates canonical output, and stops. |
| apps/desktop/src/main/platforms/pdd/pdd-session-host.ts | Sender/session/document binding | CONFIRMED | Context is bound to actual WebContents, view, READY state, active generation, and liveness. |
| apps/desktop/src/main/platforms/pdd/pdd-platform-service.ts | Main composition root | CONFIRMED / GAP | Exposes canonical ingress but also contains an independent legacy message_received branch. |
| apps/desktop/src/main/index.ts | Electron PDD page IPC wiring | CONFIRMED_GAP | Invokes handlePageEvent(payload) and drops the sender. |
| apps/desktop/src/main/platforms/pdd/pdd-page-ipc.ts | PDD page-event IPC | CONFIRMED_GAP | Sender guard exists, but validator lookup can fail open when validatorFor throws. |
| packages/platform-pdd/src/page/page-runtime.ts | DOM observer and page-event producer | CONFIRMED_SYNTHETIC_ONLY | Uses synthetic DOM contract, lastConversationId fallback, and pre-Main dedup. |
| packages/platform-pdd/src/dom/message-reader.ts | DOM transcript reader | CONFIRMED_LOSSY | Trims content before normalization. |
| packages/platform-pdd/src/message-normalizer.ts | Legacy DOM normalizer | CONFIRMED_LOSSY | Truncates to 4000 characters, hardcodes inbound, and replaces missing IDs with fingerprints. |
| packages/platform-pdd/src/selector-profile.ts | Selector provenance | CONFIRMED_GAP | Required production selectors were not observed; entries are DESIGN/synthetic data-fw-* selectors. |
| apps/desktop/src/main/platforms/pdd/pdd-orchestrator-bridge.ts | Legacy consumer bridge | CONFIRMED | Forwards normalized messages to ConversationOrchestrator, not the canonical collector. |
| apps/desktop/src/main/bootstrap.ts | Production composition | CONFIRMED_GAP | No canonical scope resolver, identity resolver, or collector callback is supplied. |
| packages/contracts/schemas/platform/pdd-page-event.schema.json | PDD page-event IPC schema | CONFIRMED_GAP | event is an unrestricted string and does not model raw PDD provenance. |
| references/pdd-customer-service-sdk/workstation/workstation.py | External research snapshot | INFERRED / DEFERRED | Shows a Playwright WebSocket frame observer, but import report marks it research-only and not production-authoritative. |

---

## 4. Current Call Chains

### Accepted canonical path

CONFIRMED CODE PATH / NO PRODUCTION CALLER:

    trusted sender + PddInboundIngressContext
    -> PddSessionHost.resolveInboundIngressBinding
    -> processPddInboundIngress
    -> normalizePddInboundForCanonical
    -> resolveInboundScope + resolveInboundIdentity
    -> mapPddInboundToCanonical
    -> canonical schema validation
    -> onCanonicalInbound collector
    -> STOP

This path is exercised by focused tests and the bounded smoke script. No product composition calls handleTrustedInboundIngress.

### Current DOM / preload / IPC path

CONFIRMED SYNTHETIC-ONLY PATH:

    PddPageRuntime.scan reads data-fw-* DOM selectors
    -> normalizeMessage trims, truncates, hardcodes inbound, and may create fallback fingerprint IDs
    -> buildMessageReceived creates a normalized page event
    -> preload sends pdd-page-event
    -> pdd-page-ipc may fail open if its module-load validator is unavailable
    -> main/index.ts drops the sender
    -> PddPlatformService.handlePageEvent(payload)
    -> message_received enters the independent legacy handleInbound branch

This is not a raw PDD producer and must not be relabelled as the historical raw PDD payload path.

### Current legacy consumer path

CONFIRMED:

    PddPlatformService.handleInbound
    -> onInboundMessage callback if configured
    else PddOrchestratorBridge
    -> ConversationOrchestrator.onBuyerMessage

Production bootstrap does not configure onInboundMessage, so the default bridge is available.

### Historical raw producer evidence

HISTORICAL LIVE OBSERVATION ONLY / NOT WIRED:

SHEEP-081 confirms titan-ws.pinduoduo.com and the raw receive fields content, from.role, from.uid, to.role, to.uid, msg_id, and client_msg_id. SHEEP-087 confirms the normalization contract. No repository implementation observes or binds Titan frames.

---

## 5. Field Source and Mapping Matrix

| Field | Raw source | Transform and trust boundary | Canonical target | Missing/conflict behavior | Status |
|---|---|---|---|---|---|
| platform | Not a producer input | Main mapper sets pdd | identityLock.platform | Fixed | CONFIRMED |
| runtimeShop | Actual sender WebContents -> senderSessions -> PddSessionHost | Main object identity and WeakMap; payload shop is not authority | identityLock.runtimeShop | Reject untrusted/invalid/stale context | CONFIRMED MECHANISM / NOT WIRED |
| merchantId / storeId / platformAccountId | Main authority only; no raw source | resolveInboundScope callback | canonical scope resolutions | No production resolver; missing facts stay UNKNOWN/UNRESOLVED | BLOCKED |
| platformCustomerId | Raw Titan from.uid | Decimal-string validation after trusted context binding | identityLock.platformCustomerId | Missing UNKNOWN; invalid REJECTED | CONFIRMED CONTRACT / NO RAW PRODUCER |
| platformMessageIdentity | Raw Titan msg_id | Nonblank string -> authoritative identity | triggerMessage.platformMessageIdentity | Missing UNKNOWN; invalid REJECTED; never fingerprint | CONFIRMED CONTRACT / DOM PATH VIOLATES |
| conversation_id / runtimeConversationReference | No confirmed raw identity | Main-owned trusted binding only | runtimeConversationReference | UNKNOWN/UNRESOLVED; no lastConversation or synthetic unknown | BLOCKED |
| internalConversationId | Trusted association only | resolveInboundIdentity plus owner checks | identityLock.internalConversationId | Unknown if missing; mismatch reject; do not create | BLOCKED |
| localMessageId | Trusted association only | resolveInboundIdentity plus owner checks | triggerMessage.localMessageId | Unknown if missing; never synthesize from msg_id | BLOCKED |
| session / WebContents / document generation | Actual sender, host instance, active generation | Main WeakMap, READY, generation, isDestroyed checks | runtimeEvidence | Reject stale, disposed, or destroyed context | CONFIRMED |
| selected customer observation | Selected DOM row, if present | Runtime evidence only | runtimeEvidence.selectedCustomerObservation | Never fills platformCustomerId | CONFIRMED EVIDENCE ONLY |
| inbound direction | Titan roles user -> mall_cs | Canonical normalizer rejects contradictory roles/direction | inbound acceptance | Unknown/outbound reject; DOM path hardcodes inbound | CONFIRMED CONTRACT / DOM PATH VIOLATES |
| content | Raw observed content | Preserve exact string | sourceContent.text | No trim; no 4000-character truncation | CONFIRMED CONTRACT / DOM PATH VIOLATES |
| sourceOccurredAt | Separate Main ingress input, not mapped from payload | Strict ISO-8601 UTC Z or null | sourceOccurredAt | Missing/malformed -> null with diagnostics; no local fallback | BLOCKED |

The DOM path trims content, truncates at 4000 characters, hardcodes direction, uses lastConversationId fallback, substitutes fallback fingerprints, and deduplicates before Main. It cannot be used as a transparent raw producer.

---

## 6. Critical Gaps and Stop Boundary

1. GAP-01 SENDER-DROPPED — CONFIRMED — BLOCKING: main/index.ts drops the IPC sender, so no production path can create the accepted sender/document context.
2. GAP-02 CANONICAL-CALLER-MISSING — CONFIRMED — BLOCKING: handleTrustedInboundIngress has no product caller.
3. GAP-03 RESOLVERS-MISSING — CONFIRMED — BLOCKING: production bootstrap supplies no scope resolver, identity resolver, or canonical collector.
4. GAP-04 LEGACY-PARALLEL-CONSUMER — CONFIRMED — BLOCKING: message_received still reaches PddOrchestratorBridge independently of the canonical gate.
5. GAP-05 PAGE-IPC-FAIL-OPEN — CONFIRMED — BLOCKING IF REUSED: validatorFor can return null and the IPC forwards unvalidated events.
6. GAP-06 SYNTHETIC-DOM-SELECTORS — CONFIRMED — BLOCKING: required production selectors were never observed; the profile is DESIGN-only.
7. GAP-07 LOSSY-PRE-MAPPER — CONFIRMED — BLOCKING IF REUSED: trim, 4000-character truncation, hardcoded inbound, fallback fingerprint, stale lastConversationId, and global pre-Main dedup.
8. GAP-08 NO-RAW-PRODUCER — CONFIRMED — BLOCKING: no repository code observes Titan frames; DOM normalized events are not raw PDD payloads.
9. GAP-09 NO-SCOPE-BINDING — BLOCKED — BLOCKING: the runtime shop is not mapped to canonical merchant/store/platform-account scope.
10. GAP-10 NO-TRUSTED-SOURCE-TIME — BLOCKED — BLOCKING: no real producer supplies or establishes sourceOccurredAt semantics.
11. GAP-11 ASSOCIATION-SOURCE-MISSING — BLOCKED — NON-BLOCKING FOR MINIMAL MAPPING: conversation/local-message associations have no production resolver and must remain UNKNOWN/UNRESOLVED rather than be fabricated.

The proposed path must stop at the canonical collector: NO AI, NO PERSISTENCE, NO SEND, NO PLATFORM BUSINESS ACTION. There must be no fallback to PddOrchestratorBridge when the collector is missing, a validator fails, or mapping throws.

---

## 7. Candidate Comparison

### DOM / preload / IPC page-event reuse

Status: BLOCKED. The current runtime is synthetic-only, performs lossy transformations before Main, drops the IPC sender, can fail open during validation, and has an independent legacy consumer branch. Reusing it without redesign would violate identity, provenance, and content preservation.

### Main-owned embedded Titan frame observer

Status: RECOMMENDED DIRECTION / BLOCKED PENDING EVIDENCE. Historical live evidence supports the Titan raw contract, and the existing PddSessionHost already provides trustworthy sender/session/document-generation binding. No current code observes frames, and the exact Electron-observable frame boundary is not established.

### Separate Titan / WebSocket client

Status: DEFERRED / NOT RECOMMENDED. It would duplicate credential and session ownership, increase multi-shop risk, and the imported external SDK is research-only and cannot be treated as production authority.

---

## 8. Recommended Next Acceptance Unit

Recommended next bounded unit: BOUNDED_REAL_PDD_TITAN_FRAME_BOUNDARY_EVIDENCE.

Purpose: obtain the minimum missing read-only evidence needed to decide whether the embedded PDD WebContents can expose a trustworthy Titan inbound frame boundary.

Scope:
- one controlled, explicitly authorized live read-only observation;
- one inbound message only;
- record field presence and correlation only, not content or identifiers;
- verify frame origin and binding to the active WebContents/session/document generation;
- verify whether source time exists and how it is represented;
- do not invoke AI, persistence, send, or platform mutation;
- do not implement product code or change the accepted canonical path.

Unblock criteria:
- exact observed frame envelope is documented;
- frame-to-session/document binding is demonstrated without trusting payload shop/session;
- source time semantics are explicit;
- canonical scope resolver values are identified or explicitly remain UNKNOWN/UNRESOLVED;
- all failures stop before collector and legacy bridge.

After that evidence passes, the proposed implementation unit is TRUSTED_MAIN_TITAN_FRAME_INGRESS:

    existing embedded PDD WebContents
    -> Main-owned read-only Titan frame observer
    -> strict frame/source validation
    -> PddSessionHost sender/session/document context
    -> handleTrustedInboundIngress
    -> canonical mapper + real schema validator
    -> canonical collector
    -> STOP

Reused implementation: PddSessionHost context binding, processPddInboundIngress, normalizePddInboundForCanonical, mapPddInboundToCanonical, canonical schema validation, and the accepted collector boundary.

Candidate files for the later unit: pdd-view-host.ts, pdd-session-host.ts, pdd-platform-service.ts, main/index.ts only if composition requires it, new pdd-titan-frame-observer.ts, new pdd-titan-ingress.test.ts, and focused session/ingress regressions.

IPC/schema impact: no new IPC channel is proposed for the Main-owned observer. The public page-event schema should not be reused for raw Titan payloads. No canonical schema or generated mirror change is expected.

Security constraints: attach only to the exact PDD WebContents; filter to the exact Titan origin; never log or persist frames, cookies, tokens, headers, or credentials; extract only confirmed fields; keep unknown internal IDs explicit; fail closed on validator failure or missing collector; never fall back to AI or the legacy bridge.

---

## 9. Test Plan

1. T01: one controlled frame from the exact trusted session/document generation maps one canonical envelope through the real validator.
2. T02: two shops with identical opaque customer/message IDs remain isolated.
3. T03: wrong owner scope/customer/message association is rejected and collector is unchanged.
4. T04: delayed old-document frames, reload, dispose/recreate, destroyed WebContents, forged/missing context, wrong sender/frame are rejected or discarded.
5. T05: missing customerUid/msg_id remains UNKNOWN; present-but-invalid/conflicting values are rejected; no fallback fingerprint.
6. T06: direction, message provenance, exact content, and source time satisfy the canonical contract.
7. T07: mapper, validator, collector, and async-return failures stop with no collector increase and no legacy fallback.
8. T08: success and failure paths keep AI, transport send, persistence, and legacy bridge calls at zero at the selected boundary.
9. T09: real WebContents frame reachability is only provable by a separately authorized live read-only observation; it is not offline-provable.

---

## 10. Evidence Limitations

- No live PDD/Electron session was started.
- No network, WebSocket, Debugger, or Titan inspection was performed.
- No product tests were run for this governance-level audit.
- Historical live evidence is not a current runtime proof.
- The external SDK is a research snapshot and is not production authority.
- UNKNOWN remains a valid result; the audit does not upgrade missing facts to RESOLVED.

---

## 11. Validation

- REPORT_JSON_PARSE: PASS.
- PROJECT_STATE_CONSISTENCY: PASS via node scripts/validate-project-state.mjs project/PROJECT_STATE.json.
- project-state-consistency tests: 18 passed / 0 failed.
- AUDIT_REFERENCE_PATHS: PASS.
- git diff --cached --check: PASS.
- Changed-file scope: exactly the two permitted audit artifacts.

---

## 12. Final Audit Status

AUDIT_RESULT: COMPLETE
IMPLEMENTATION_READINESS_RECOMMENDATION: BLOCKED
CONTROLLER_REVIEW_STATUS: AWAITING_CONTROLLER_REVIEW
implementation_performed = false
implementation_authorized = false
live_validation_performed = false
full_sheep_301_closed = false
next_stage_not_executed = true

STOP. No implementation or live validation may begin from this audit.
