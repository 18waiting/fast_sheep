# SHEEP-301 — Remaining Real-Producer Integration Readiness Audit

> Task: SHEEP-301
> Acceptance Unit: REMAINING_REAL_PRODUCER_INTEGRATION_READINESS_AUDIT
> Mode: READ-ONLY AUDIT REPAIR
> Original baseline: e82dd4ca46a61aa2148ed693039fad6c325b0a4b
> Repair baseline: e3aa108a69bee71df44ea7272452b583fca0d63d
> Audit result: COMPLETE
> Offline boundary proof readiness: READY_WITH_CONSTRAINTS
> Production PDD ingress readiness: BLOCKED
> Live validation authorization: NOT_AUTHORIZED
> Controller review status: AWAITING_CONTROLLER_REVIEW

This repair preserves the original findings of missing production producer wiring while correcting stage classification, UNKNOWN/null semantics, and the offline feasibility of a Main-owned WebSocket boundary proof. It does not authorize or implement production wiring, live PDD observation, AI, persistence, send, or platform action.

---

## 1. Product and Safety Preflight

- PRODUCT_ALIGNMENT: trusted inbound identity and canonical delivery remain the current MVP foundation.
- CURRENT_MVP_RELEVANCE: HIGH.
- CUSTOMER_VALUE: reliable capture of actual customer messages without identity substitution or silent loss.
- SAFETY_IMPACT: HIGH.
- OUT_OF_SCOPE: product/source implementation, production observer wiring, live PDD/network access, AI, persistence, send, and later tasks.
- DECISION: PROCEED.
- CANONICAL_AUTHORITY_READ: AGENTS.md authority order, PROJECT_STATE, canonical IdentityLock/InboundEnvelope contracts, accepted bounded review/report, and the two audit artifacts.
- IDENTITY_SCOPE: runtime shop/session/view/document generation plus canonical merchant/store/account/customer/conversation/message associations.
- SIDE_EFFECT_CLASS: repository read and isolated offline diagnostic only.
- UNKNOWN_BEHAVIOR: UNKNOWN/UNRESOLVED is preserved and never upgraded by display names, selected customer, or coincident strings.
- ROLLBACK_OR_STOP_CONDITION: stop on any requirement to modify product code, run a production bootstrap, access live PDD/Titan, or open a forbidden side effect.

---

## 2. Facts Preserved

- SHEEP-300 is CLOSED.
- MAIN_LOCAL_RAW_INGRESS_BOUND_CONTROLLED_FIXTURE_MAPPING remains PASS.
- Full SHEEP-301 is PARTIAL / OPEN.
- No production real PDD inbound producer is currently wired.
- Accepted canonical ingress remains callable only through tests/smoke and any future authorized caller.
- The legacy page-event path still drops the IPC sender, can fail open validation, and retains an independent message_received to orchestrator branch.
- The DOM path remains synthetic-DESIGN-only and lossy before canonical mapping.
- Real PDD/Titan behavior remains unverified.

---

## 3. Corrected Interpretations

### sourceOccurredAt

The accepted ingress treats source time as nullable/partial:

- missing -> sourceOccurredAt = null with SOURCE_TIME_MISSING;
- malformed string -> sourceOccurredAt = null with SOURCE_TIME_INVALID;
- current non-string/non-null input is normalized to null by the ingress helper, not a mandatory whole-message rejection;
- a known valid business source time, if evidenced, must be preserved exactly;
- Date.now, receipt time, and unproven CDP MonotonicTime must not replace platform occurrence time.

Therefore source-time absence is not a general blocker to the minimal inbound mapping. It remains a production semantic completeness gap where downstream consumers require source time.

### Resolver, collector, and canonical facts

- Missing resolver/collector wiring is a pending implementation/composition item.
- Whether a canonical value is known is a fact-completeness issue, separate from wiring.
- runtimeShop must come from trusted Main session/document binding; payload self-report is not authority.
- Missing or conflicting Main scope authority must fail closed where the capability requires it.
- merchantId, storeId, platformAccountId, runtimeConversationReference, internalConversationId, localMessageId, and sourceOccurredAt may remain UNKNOWN/UNRESOLVED when legally unknown.
- UNKNOWN does not grant persistence, aggregation, AI, or send authority.

### Existing Main authority sources

- workspaceMerchant is established in Main composition and represents the workspace merchant authority.
- StoreRepository and PlatformAccountRepository are present in Main composition and are backed by SQLite in the worker-backed production path.
- The runtime shop is not automatically a canonical Store or PlatformAccount.
- No PDD resolveInboundScope/resolveInboundIdentity implementation currently connects these sources to canonical inbound values.

---

## 4. Source Inventory

| Source | Role | Evidence status |
|---|---|---|
| packages/platform-pdd/src/inbound-normalizer.ts | Raw and canonical-ingress normalization | CONFIRMED |
| packages/platform-pdd/src/inbound-to-canonical.ts | Pure canonical mapper | CONFIRMED |
| apps/desktop/src/main/platforms/pdd/pdd-inbound-ingress.ts | Accepted Main gate | CONFIRMED |
| apps/desktop/src/main/platforms/pdd/pdd-session-host.ts | Sender/session/document/liveness binding | CONFIRMED |
| apps/desktop/src/main/platforms/pdd/pdd-platform-service.ts | Canonical path plus legacy page-event path | CONFIRMED / GAP |
| apps/desktop/src/main/index.ts | PDD IPC composition | CONFIRMED / GAP |
| apps/desktop/src/main/platforms/pdd/pdd-page-ipc.ts | PDD page-event IPC | CONFIRMED / GAP |
| packages/platform-pdd/src/page/page-runtime.ts | Synthetic DOM observer | CONFIRMED / SYNTHETIC_ONLY |
| packages/platform-pdd/src/dom/message-reader.ts | Trims content before normalization | CONFIRMED / LOSSY |
| packages/platform-pdd/src/message-normalizer.ts | Truncates, hardcodes direction, fingerprints | CONFIRMED / LOSSY |
| packages/platform-pdd/src/selector-profile.ts | Required selectors are DESIGN-only | CONFIRMED / GAP |
| apps/desktop/src/main/bootstrap.ts | Main composition | CONFIRMED / GAP |
| apps/desktop/src/main/worker-runtime.ts | Production persistence and workspace-merchant sources | CONFIRMED |
| packages/contracts/schemas/platform/pdd-page-event.schema.json | Synthetic page-event schema | CONFIRMED / GAP |
| references/pdd-customer-service-sdk/workstation/workstation.py | Research-only external design hint | INFERRED / DEFERRED |

---

## 5. Actual and Proposed Call Chains

### Current production path

    PDD page runtime (synthetic DOM selectors)
    -> pdd-page-event IPC
    -> main/index drops sender
    -> PddPlatformService.handlePageEvent(payload)
    -> independent legacy message_received branch
    -> onInboundMessage or PddOrchestratorBridge

This is not the accepted canonical producer path and it is not a real PDD raw payload producer.

### Accepted canonical path

    trusted sender + PddInboundIngressContext
    -> session/document-generation revalidation
    -> raw PDD semantic normalization
    -> Main scope and identity association checks
    -> canonical mapper
    -> canonical schema validation
    -> collector
    -> STOP

### Proposed offline boundary chain

    isolated local Electron WebContents
    -> synthetic loopback WebSocket
    -> Main-owned Debugger/Network instrumentation
    -> requestId/connection binding to target WebContents and document generation
    -> test-only normalization and canonical collector
    -> STOP

This chain is a mechanism proof candidate, not a production Titan integration.

---

## 6. Field and Trust Matrix

| Field | Source and trust boundary | Missing/conflict behavior | Corrected classification |
|---|---|---|---|
| runtimeShop | actual sender WebContents -> PddSessionHost; payload is not authority | reject untrusted/invalid/stale binding | trusted mechanism exists; production caller pending |
| merchant/store/platform account | workspaceMerchant / StoreRepository / PlatformAccountRepository via explicit Main resolver | UNKNOWN/UNRESOLVED if no trusted mapping; conflict fails closed | wiring pending; facts may be unknown |
| platformCustomerId | raw from.uid after trusted producer binding | missing UNKNOWN; invalid reject | contract confirmed; no current raw producer |
| platformMessageIdentity | raw msg_id after trusted producer binding | missing UNKNOWN; invalid reject; never fingerprint | contract confirmed; legacy DOM path violates |
| runtimeConversationReference | trusted Main binding only | UNKNOWN/UNRESOLVED; no lastConversation fallback | no trusted production source |
| internalConversationId | trusted association only | UNKNOWN/UNRESOLVED; never create in SHEEP-301 | legal unknown allowed |
| localMessageId | trusted association only | UNKNOWN/UNRESOLVED; never synthesize from msg_id | legal unknown allowed |
| session / WebContents / generation | actual target, Main WeakMap, READY state, liveness | reject stale/disposed/destroyed | confirmed mechanism |
| selected customer observation | runtime evidence only | never fills platformCustomerId | confirmed evidence only |
| direction | roles from.role=user, to.role=mall_cs | reject contradictory/outbound; DOM hardcode is invalid | contract confirmed; DOM path violates |
| content | raw observed content | preserve exactly; no trim/truncation | contract confirmed; DOM path violates |
| sourceOccurredAt | separate validated input | missing/malformed -> null + diagnostics; do not invent time | nullable partial; not required for minimal mapping |

---

## 7. Gap Classification by Path and Stage

| Gap | Applies to | Blocks | Class | Minimal resolution |
|---|---|---|---|---|
| GAP-01 sender dropped | legacy DOM/page-event path | canonical binding if that path is reused | TODO_IMPLEMENTATION | pass sender and resolve by sender; not a blocker to a separate observer |
| GAP-02 no canonical production caller | production ingress composition | production canonical delivery | TODO_IMPLEMENTATION | add the authorized producer caller; offline proof may use a test adapter |
| GAP-03 resolver/collector not wired | production ingress composition | production scope/identity resolution and collector delivery | TODO_IMPLEMENTATION | explicit composition injection; test-only resolver/collector for offline proof |
| GAP-04 legacy parallel consumer | selected path plus legacy DOM path | safe production ingress if both can consume | TODO_IMPLEMENTATION | make selected path exclusive; prove old bridge is unreachable on failure |
| GAP-05 page IPC fail-open | legacy page-event path | safe reuse of that IPC route | TODO_IMPLEMENTATION | fail closed when validator is unavailable; not a blocker for Main-owned observer |
| GAP-06 synthetic DOM selectors | legacy DOM path | using DOM as real producer | evidence gap or path avoidance | get confirmed selectors separately or avoid DOM |
| GAP-07 lossy DOM pre-mapper | legacy DOM path | exact identity/provenance/content if reused | TODO_IMPLEMENTATION_IF_REUSED | remove trim/truncate/hardcode/fingerprint/stale conversation/global dedup before mapping |
| GAP-08 no current raw producer | production PDD ingress | observing real PDD today | implementation and evidence gap | prove Main observer offline, then separately prove real PDD under live authorization |
| GAP-09 scope binding/facts | production ingress composition | known canonical scope values | wiring pending / legal unknown allowed | use existing Main sources only with trusted mapping; otherwise UNKNOWN/UNRESOLVED |
| GAP-10 source time | production ingress semantics | known platform source-time fidelity, not minimal mapping | evidence gap / nullable partial | preserve a validated business time or keep null; never use receipt/MonotonicTime |
| GAP-11 association source | production ingress enrichment | resolved conversation/local-message enrichment | legal unknown / future consumer requirement | keep UNKNOWN/UNRESOLVED; no create/write/persist in SHEEP-301 |

Source-time absence and legal unknown canonical facts do not alone justify production readiness failure. Current missing producer wiring, unresolved legacy isolation, and unverified real PDD behavior remain distinct issues.

---

## 8. Offline Electron/WebSocket Boundary Feasibility

### Observed local environment

- Electron: 43.6.0.
- Chromium: 150.0.7871.250 from the local diagnostic process.
- Node: 24.20.0 from the local diagnostic process.
- The project-local Electron declaration is node_modules/.pnpm/electron@43.6.0/node_modules/electron/electron.d.ts.
- Official API references: https://www.electronjs.org/docs/latest/api/debugger, https://www.electronjs.org/docs/latest/api/web-contents, https://chromedevtools.github.io/devtools-protocol/tot/Network/.

### Diagnostic probe

diagnostic_probe_performed = true.

The probe used an isolated local Electron BrowserWindow, memory partition, synthetic loopback WebSocket server, synthetic messages only, and no PDD/Titan/Live connection. It did not load the Fast Sheep production bootstrap and did not access AI, persistence, or send.

Observed methods:

- Network.webSocketCreated
- Network.webSocketWillSendHandshakeRequest
- Network.webSocketHandshakeResponseReceived
- Network.webSocketFrameSent
- Network.webSocketFrameReceived

Observed fields:

- webSocketCreated: requestId, url, optional initiator.
- handshake request: requestId, MonotonicTime timestamp, wallTime, request headers.
- handshake response: requestId, response status and headers.
- frame sent/received: requestId, MonotonicTime timestamp, response opcode, mask, payloadData.

The probe did not observe document generation, frameId, platform identity, or platform source time in WebSocket frame events. The sessionId supplied on the local root Debugger message event was empty. Main must maintain the binding itself.

Terminology: Debugger sessionId identifies the CDP debugging session, Network requestId identifies the WebSocket connection, and CDP WebSocketFrame is an entire WebSocket message. None is a platform message ID, browser frame, document generation, or internal conversation identity.

### Binding model

1. Attach one Debugger to the exact WebContents owned by one PddViewHost/session.
2. Record WebContents, session identity, and active document generation at observer attachment time.
3. On webSocketCreated, bind requestId plus the approved URL/origin to that observer only if the observer is current.
4. On every frame, use the pre-existing connection binding; do not look up and replace the current document generation after the frame arrives.
5. On navigation start, invalidate old requestId bindings before or at the generation transition.
6. Discard delayed old-connection events, unknown requestIds, detached observers, destroyed WebContents, and binding mismatches.
7. Treat debugger detach as terminal for that observer. Require a new attach and connection-binding cycle.

### Lifecycle expectations

- reload: old document generation and all old requestId bindings are invalid; late events are discarded.
- delayed old connection: no repair against the current generation; no payload shop/session/generation fallback.
- dispose/recreate: destroy old observer state and connection maps; never reuse labels.
- destroyed WebContents: stop routing and discard queued events.
- debugger detach: stop that observer and do not infer ownership from later frames.
- ownership unknown: discard or STOP; never route to canonical collector on a guess.

### Offline versus live

Offline can prove: API availability, event names and fields, requestId continuity for a synthetic WebSocket, per-target observer separation, lifecycle invalidation mechanics, and same-service isolation using controlled synthetic sessions.

Only a future authorized real PDD observation can prove: actual Titan URL/origin and connection establishment, actual text/binary payload framing, compression/reconnect/replay behavior, real source-time semantics, and real PDD compatibility.

---

## 9. Next-Step Comparison

Preferred next unit: LOCAL_ELECTRON_WEBSOCKET_BOUNDARY_PROOF.

- It resolves the current mechanism uncertainty without PDD/Titan or live access.
- It can test the same-service two-controlled-session isolation model.
- It can exercise reload, delayed old events, dispose/recreate, destruction, and detach using synthetic local data.
- It does not prove PDD/Titan compatibility and must not claim production readiness.

Alternative: a separately authorized real PDD minimal observation.

- Needed only for actual Titan connection, payload framing, replay/reconnect, and real source-time questions.
- It is later than the offline proof, not a prerequisite for the offline mechanism unit.

---

## 10. Recommended Next Acceptance Unit

LOCAL_ELECTRON_WEBSOCKET_BOUNDARY_PROOF

Purpose: prove that a Main-owned observer can bind an isolated Electron WebContents WebSocket connection to the originating session/document and deliver synthetic inbound data to a test-only canonical collector without legacy fallback.

Required evidence: Debugger attach/detach, Network event availability, requestId continuity, connection-to-document-generation binding, same-service isolation, lifecycle invalidation, validator/collector failure behavior, and no legacy consumer path.

Implementation composition file scope for the later production unit must include, when authorized, apps/desktop/src/main/bootstrap.ts and apps/desktop/src/main/worker-runtime.ts if resolver or scope-source injection is required. The prior audit's candidate list omitted those composition requirements and is corrected here.

IPC/schema impact for the offline proof: no production IPC channel, no canonical schema change, and no generated-mirror change. The proof needs only a test-owned observer adapter and synthetic loopback transport.

---

## 11. Test Plan

1. T01: one controlled frame from the exact trusted session/document generation maps one canonical envelope through the real validator.
2. T02: two controlled sessions in the same management service use equal opaque customer/message IDs and remain isolated.
3. T03: wrong owner scope/customer/message association across the same-service harness is rejected; collector unchanged.
4. T04: delayed old-document frames, reload, dispose/recreate, destroyed WebContents, missing/forged context, wrong sender/frame, and debugger detach are discarded or rejected.
5. T05: missing customerUid/msg_id remains UNKNOWN; present-but-invalid/conflicting values are rejected; no fallback fingerprint.
6. T06: direction, message provenance, exact content, and source time follow the canonical contract; missing/invalid time remains null.
7. T07A: mapper/validator/identity checks fail before collector; collector is not called.
8. T07B: collector was called and then throws or returns an unsupported Promise; return explicit FAILED, observe rejection, do not report MAPPED, do not retry, and do not fall back to legacy bridge. Collector side effects already performed cannot be rolled back.
9. T08: success and failure paths keep AI, send, persistence, and legacy bridge calls zero at the selected boundary.
10. T09: real PDD/Titan frame compatibility remains a separately authorized live question.
11. T10: requestId, document generation, and observer detach state remain scoped to the originating same-service session.

---

## 12. Authorization Semantics

- OWNER_ATTESTED_PERMISSION is preserved.
- Embedded-runtime-first remains the PDD implementation direction.
- Current live/network observation is NOT_AUTHORIZED.
- This repair adds no blanket commercial/compliance gate.
- Existing deferred platform/commercial-compliance tracking remains unchanged and applies only if a future authorized implementation reaches that scope.
- Second reply scene, SHIPPING_TIME rule, and SHEEP-310 retry conflict remain unchanged.

---

## 13. Validation and Evidence Limits

- REPORT_JSON_PARSE: PASS.
- PROJECT_STATE_CONSISTENCY: PASS.
- project-state-consistency tests: 18 passed / 0 failed.
- Audit source reference paths: PASS.
- Isolated Electron 43.6.0 synthetic loopback WebSocket probe: PASS; webSocketCreated, handshake, frameSent, and frameReceived were observed.
- At the readiness-repair baseline, the full LOCAL_ELECTRON_WEBSOCKET_BOUNDARY_PROOF had not yet been performed; it was subsequently completed in section 15.
- git diff --cached --check: PASS with line-ending normalization warnings only.
- Changed-file scope: PASS; exactly the two permitted audit artifacts.
- Artifact consistency check: PASS.


- diagnostic_probe_performed = true for the isolated local Electron/WebSocket API probe.
- The probe used synthetic loopback data and did not connect to PDD/Titan.
- No production bootstrap, real seller session/profile, AI, persistence, send, or platform business action was used.
- Official docs prove API descriptions, not current project-version behavior; the local Electron 43.6.0 probe confirms only the observed local events and fields.
- Real PDD/Titan behavior remains unverified and must not be inferred from the local probe or historical evidence alone.

---

## 14. Final Status

AUDIT_RESULT: COMPLETE
OFFLINE_BOUNDARY_PROOF_READINESS: READY_WITH_CONSTRAINTS
PRODUCTION_PDD_INGRESS_READINESS: BLOCKED
LIVE_VALIDATION_AUTHORIZATION: NOT_AUTHORIZED
RECOMMENDED_NEXT_ACCEPTANCE_UNIT: LOCAL_ELECTRON_WEBSOCKET_BOUNDARY_PROOF
CONTROLLER_REVIEW_STATUS: AWAITING_CONTROLLER_REVIEW
implementation_performed = false
implementation_authorized = false
live_validation_performed = false
full_sheep_301_closed = false
next_stage_not_executed = true

STOP. Awaiting Controller review; no production implementation or live validation may begin from this audit.

---

## 15. Local Electron/WebSocket Boundary Proof Result

- Acceptance unit: LOCAL_ELECTRON_WEBSOCKET_BOUNDARY_PROOF.
- Controller readiness PASS baseline: 8fb05f70d264943447981d19aa71a1dd4618c2b5.
- Diagnostic implementation: PERFORMED / test-owned only.
- Offline boundary proof: COMPLETE.
- Report: reports/SHEEP-301-local-electron-websocket-boundary-proof-report.json.
- Runner: scripts/run-sheep-301-local-electron-websocket-boundary-proof.mjs.
- Production implementation: NOT PERFORMED.
- Production PDD ingress readiness: BLOCKED.
- Live validation authorization: NOT_AUTHORIZED.
- Full SHEEP-301: PARTIAL / OPEN.
- Controller review status: AWAITING_CONTROLLER_REVIEW.

The proof exercised two real WebContentsView sessions managed by one PddPlatformService, loopback WebSocket traffic through Main-owned Debugger/Network observation, connection-time requestId binding, real canonical ingress/mapper/default validator, collector-before/after failure behavior, downstream isolation, reload, dispose/recreate, destroy, detach, stale frame, and stale connection-created paths.

The proof does not establish real Titan URL/framing/compression/reconnect/replay behavior, real PDD runtime compatibility, real business source time, or production readiness.

---

## 16. Local Boundary Proof Repair Record

- Controller decision on the prior proof: REPAIR.
- Repair baseline: ab205372f858db736405ff2195bc9a307acae9a1.
- Repaired offline proof result: COMPLETE.
- Repaired report: reports/SHEEP-301-local-electron-websocket-boundary-proof-report.json.
- Controller review status: AWAITING_CONTROLLER_REVIEW.
- Production implementation: NOT PERFORMED.
- Production PDD ingress readiness: BLOCKED.
- Live validation authorization: NOT_AUTHORIZED.
- Full SHEEP-301: PARTIAL / OPEN.

The repaired run used sandboxed Electron, distinct non-persistent memory sessions, repository-resolved Electron/ws dependencies, a strict REPO_ROOT-derived temporary root, CDP session plus callback lifecycle validation, legal-text stale-event tests, Main-controlled association configuration, and dynamic local WebSocket/send-boundary counters. The historical prior Codex COMPLETE is preserved; it is not rewritten as a Controller PASS.

Validation for the repaired unit:
- Exact proof command: node scripts/run-sheep-301-local-electron-websocket-boundary-proof.mjs.
- Proof runner exit: 0.
- PROJECT_STATE JSON parse and consistency: PASS.
- project-state consistency suite: 18 passed / 0 failed.
- Focused desktop PDD regressions: 48 passed / 0 failed.
- Focused platform-pdd regressions: 17 passed / 0 failed.
- Report JSON parse, diff check, changed-file scope, and authorization gates: PASS.
