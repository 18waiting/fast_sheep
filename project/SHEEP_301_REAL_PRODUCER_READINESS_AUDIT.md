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

---

## 17. Targeted Boundary Proof Repair Result (ff85808)

- Task: SHEEP-301.
- Acceptance unit: LOCAL_ELECTRON_WEBSOCKET_BOUNDARY_PROOF.
- Mode: TARGETED_DIAGNOSTIC_REPAIR.
- Controller decision: REPAIR.
- Repair baseline: ff858088e018de5a5f12b8539d2d6c1a51c23c37.
- Prior repair baseline retained: ab205372f858db736405ff2195bc9a307acae9a1.
- Repaired offline proof result: COMPLETE.
- Completion gate: PASS.
- Production implementation: NOT PERFORMED.
- Production PDD ingress readiness: BLOCKED.
- Live validation authorization: NOT_AUTHORIZED.
- Live validation performed: false.
- Full SHEEP-301: PARTIAL / OPEN.
- Controller review status: AWAITING_CONTROLLER_REVIEW.

This section supersedes only the status of the earlier repaired proof run in section 16 for the purpose of current review. Section 16 remains the historical record of the first REPAIR at ab20537 and is not rewritten as a Controller PASS.

### R1 — Project-root proof directory

- The runner resolves the proof root with resolve(REPO_ROOT, ".tmp", "sheep-301-local-electron-websocket-boundary-proof").
- The actual proof root for this run is E:\fast_sheep\.tmp\sheep-301-local-electron-websocket-boundary-proof.
- The launcher validates the derived path before spawning Electron; main.mjs validates again before creating userData, sessionData, cache, log, temp, or run directories.
- The path policy checks relative REPO_ROOT containment and exact proof-root equality. It rejects the sibling E:\fast_sheep.tmp path and parent-traversal candidates.
- Node path regressions: 4 passed / 0 failed; the rejected paths remain absent.
- Historical outside-root writes from the old readiness probe, ab20537, and ff85808 remain preserved as historical facts. No cleanup or further write outside the project root is authorized by this task.

### R3A — Old callback versus raw old event

- Captured old callback delivery after main-document replacement: rejected as OBSERVER_TERMINAL before context resolution.
- Un-tokened raw old connection-created delivery through the current listener path after main-document replacement: rejected as OBSERVER_TERMINAL without manually supplying an old callback token.
- Both negatives assert zero context-resolution delta and zero collector growth.
- Same-WebContents navigation recovery is explicitly NOT_SUPPORTED; reattach is refused with SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED. A new trusted lifecycle requires a new WebContents.
- The raw old-event negative is a test-owned delivery path after Electron navigation removed the listener. It is not described as a naturally observed CDP event.

### R3B — Cancellation and navigation lifecycle

- start(waitForLoad=true) followed by detach removes the pending did-finish-load listener and prevents attach.
- A pending Network.enable completion after detach cannot restore enabled or ready state.
- An old asynchronous completion after a replacement lifecycle cannot mutate the replacement lifecycle.
- did-start-navigation ignores same-document navigation and subframe navigation; main-document replacement stops the lifecycle and clears bindings/listeners.
- Attach failure, Network.enable failure, external debugger detach, and repeated detach clean up listeners and settle the lifecycle without unhandled rejection.
- Node observer lifecycle regressions: 10 passed / 0 failed.

### R4 — Completion gate

- The proof declares the full required check set A0-A8, A3b, T07A1-T07A5, and T07B1-T07B2.
- The final completion gate requires every listed check to be present and PASS.
- It independently requires path validation PASS, legacyBridgeCalls = 0, transportSendCalls = 0, zero unhandled rejections or exceptions, and cleanup success.
- A missing check, path violation, lifecycle negative failure, unresolved rejection, or cleanup failure forces PARTIAL and a non-zero process exit.

### Validation for this repair

- Fresh builds: @fastwork/domain, @fastwork/platform-pdd, and @fastwork/desktop all exited 0.
- Targeted Node regressions: 14 passed / 0 failed (4 path-policy + 10 observer lifecycle).
- Full local Electron proof: node scripts/run-sheep-301-local-electron-websocket-boundary-proof.mjs exited 0.
- Electron proof checks: 17 passed / 0 failed.
- Completion gate: PASS.
- Runtime: Electron 43.6.0, Chromium 150.0.7871.250, Node 24.20.0.
- Runtime security: sandbox enabled, contextIsolation enabled, nodeIntegration disabled, webSecurity enabled, no sandbox-disabling switch, two distinct non-persistent memory sessions.
- Downstream counters: legacyBridgeCalls = 0, transportSendCalls = 0, AI calls = 0, business persistence writes = 0; loopback WebSocket traffic is reported separately.

The repaired proof still does not establish real Titan URL/framing/compression/reconnect/replay behavior, real PDD runtime compatibility, real business source time, or production ingress readiness.

---

## 18. Terminal Lifecycle Repair Result (8588d63)

- Task: SHEEP-301.
- Acceptance unit: LOCAL_ELECTRON_WEBSOCKET_BOUNDARY_PROOF.
- Mode: TERMINAL_LIFECYCLE_REPAIR.
- Controller decision: REPAIR.
- Repair baseline: 8588d63b61f03191541e7efa88da74f094577a41.
- Prior repair baselines retained: ff858088e018de5a5f12b8539d2d6c1a51c23c37 and ab205372f858db736405ff2195bc9a307acae9a1.
- Repaired offline proof result: COMPLETE.
- Completion gate: PASS.
- Same-WebContents recovery: NOT_SUPPORTED_AFTER_TERMINATION.
- Production implementation: NOT PERFORMED.
- Production PDD ingress readiness: BLOCKED.
- Live validation authorization: NOT_AUTHORIZED.
- Live validation performed: false.
- Full SHEEP-301: PARTIAL / OPEN.
- Controller review status: AWAITING_CONTROLLER_REVIEW.

### Baseline reproduction

A local baseline probe against 8588d63 was saved under:
E:\fast_sheep\.tmp\sheep-301-terminal-lifecycle-baseline\baseline-result.json.

R3C-1 reproduced:
- main-document replacement made the observer terminal;
- reattach returned SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED;
- direct start({waitForLoad:false}) nevertheless returned READY;
- the old connection-created/text-frame route then resolved context and reached ingress and collector.

R3C-2 reproduced:
- external debugger detach terminated the observer and removed the navigation listener;
- reattach on the same WebContents returned READY;
- the old event route then resolved context and reached ingress and collector.

### Terminal lifecycle constraint

The repaired observer uses a module-level WeakSet keyed by the actual WebContents object. Once that object's diagnostic observation lifecycle terminates, every future activation entry is stopped:

- start();
- reattach();
- attachDebugger();
- enableNetwork();
- construction of a replacement observer for the same WebContents.

The terminal state survives terminal-state resets and does not rely on numeric WebContents id, shop string, or session string. A new WebContents object with the same business identifiers can establish a new trusted lifecycle.

Every terminal activation request returns STOPPED with reason SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED, leaves terminal=true and enabled=false, removes listeners, does not resolve context, and does not call canonical ingress or collector.

### Regression coverage

- Main-document replacement: direct start and reattach are rejected; captured old callback, captured old text frame, and un-tokened raw old event cause zero context-resolution, ingress, and collector growth.
- External debugger detach followed by a navigation event: direct start and reattach are rejected; listener counts remain zero.
- A replacement BoundaryObserver on the same WebContents is terminal from construction and cannot acquire a binding.
- A new WebContents object can establish a new lifecycle; the legal connection is bound and the legal frame reaches the real mapper/default validator/collector once.
- Existing attach/enable failure, pending-completion cancellation, idempotent detach, same-document/subframe navigation, and listener-cleanup coverage remains.

### Validation

- Targeted Node path/lifecycle regressions: 14 passed / 0 failed.
- Full sandboxed Electron loopback proof: exit 0.
- Electron proof checks: 17 passed / 0 failed.
- Completion gate: PASS.
- Downstream counters: legacy bridge/send/AI/business persistence = 0.
- Unhandled exceptions/rejections: 0.
- PROJECT_STATE JSON parse, consistency validation, report JSON parse, diff check, and changed-file scope checks are run before delivery.

Same-WebContents recovery remains unproven and is deliberately NOT SUPPORTED for this diagnostic unit. Real PDD/Titan runtime behavior, framing, reconnect/replay, and production ingress remain deferred and unauthorized.

---

## 19. Trusted Main PDD Ingress Readiness Audit (0412a7d)

- Task: SHEEP-301.
- Acceptance unit: TRUSTED_MAIN_PDD_INGRESS_READINESS_AUDIT.
- Mode: READ_ONLY_CODE_AUDIT / DOCUMENTATION_ONLY.
- Original audit baseline: 0412a7d8c2497b9f15703f5aac1ec0ffcdcfb578.
- Previous targeted repair baseline: a5d4bfd73502e3569142186c85335e9e947aca64.
- Current repair baseline: e8f9f6353f92efe5224d2429bfb9b3a0f18cec7f.
- Current repair scope: PATH_AND_EVIDENCE_REPAIR / R1_STARTUP_TIMING / R2_IDENTITY_HANDOVER / R3_LEGACY_ISOLATION / R4_CLASSIFICATION.
- Current repair result: COMPLETE.
- Prerequisite acceptance: LOCAL_ELECTRON_WEBSOCKET_BOUNDARY_PROOF COMPLETE / CONTROLLER PASS.
- Reviewed implementation commit: 0412a7d8c2497b9f15703f5aac1ec0ffcdcfb578.
- Diagnostic implementation authorization: COMPLETED / CONSUMED.
- AUDIT_RESULT: COMPLETE.
- NEXT_UNIT_IMPLEMENTATION_READINESS: READY_WITH_CONSTRAINTS.
- PRODUCTION_PDD_INGRESS_READINESS: BLOCKED.
- LIVE_VALIDATION_AUTHORIZATION: NOT_AUTHORIZED.
- Controller review status for this audit: AWAITING_CONTROLLER_REVIEW.
- Full SHEEP-301: PARTIAL / OPEN.
- last_closed_task: SHEEP-300.

The proof PASS covers only the controlled local Electron/WebSocket diagnostic boundary. Same-WebContents recovery after termination is NOT_SUPPORTED for that diagnostic unit and is not a production architecture decision. The earlier bounded fixture mapping PASS remains unchanged.

### Current production call chain

    PddPlatformService.activate
    -> PddSessionHost.createAndLoad
    -> PddViewHost create + bindPddDocumentLifecycle
    -> production loadProductionEntry
    -> dom-ready
    -> pdd-page-lifecycle-start preload message
    -> PddPageRuntime.observeReadiness / domHealth using PDD_SELECTOR_PROFILE
    -> page_ready only when required selectors match
    -> PddSessionHost status READY

The legacy page-event chain remains independently reachable:

    PDD preload -> pdd-page-event IPC
    -> main/index.ts callback drops sender
    -> PddPlatformService.handlePageEvent(payload)
    -> payload session_id/shop_id routing
    -> handleInbound
    -> onInboundMessage or PddOrchestratorBridge
    -> ConversationOrchestrator

No production caller currently invokes handleTrustedInboundIngress. Production composition constructs PddPlatformService without resolveInboundScope, resolveInboundIdentity, or onCanonicalInbound.

### Authority and lifecycle facts

The available Main authority sources are intentionally distinct:

- workspaceMerchant provides a stable Main-owned merchant id and merchant containment only.
- StoreRepository provides StoreRecord id/merchant/platform/name lookup and merchant listing.
- PlatformAccountRepository provides PlatformAccountRecord id/merchant/platform and an optional opaque externalRef.
- None of these repositories currently provides a runtime-Shop-to-canonical-Store or runtime-Shop-to-PlatformAccount mapping.
- Until an explicit trusted mapping exists, the resolver must return UNKNOWN/UNRESOLVED or reject; runtime Shop must not be auto-equated with either canonical object.

Lifecycle handling currently behaves as follows:

- navigation: beginDocumentLifecycle clears selected-customer observation, increments documentGeneration, and invalidates old context records by generation equality.
- reauth: AUTH_REAUTH_REQUIRED suppresses selected-customer handling; createInboundIngressContext requires READY, so no new canonical context is issued during the latch.
- detach/destroy: observer listeners are removed and terminal; PddSessionHost revalidation additionally checks READY and webContents.isDestroyed().
- dispose/recreate: PddSessionHost.dispose nulls the view, clears selected-customer evidence, and sets DISPOSED. A production recovery unit must create a new WebContents/session rather than reuse a terminated one.
- recovery choices for the next unit: new WebContents per lifecycle (preferred and offline-verifiable), no recovery/STOP (current diagnostic-safe behavior), or same-WebContents recovery only after a separate Main-owned binding design and future live validation (not approved).

### Historical sibling-path probe

The prior audit recorded a startup probe run under the sibling path `E:/fast_sheep.tmp/sheep-301-ingress-startup-readiness`. That run is preserved as historical evidence but is not project-root execution evidence.

- Old probe root, read-only: `E:/fast_sheep.tmp/sheep-301-ingress-startup-readiness`
- Historical archive: `E:/fast_sheep/.tmp/sheep-301-ingress-startup-readiness/historical/e8f9f63`
- Copies retained: `probe-main.mjs`, `probe-result.json`, `probe-precheck-timeout.json`, `probe-progress.log`
- The old directory was not deleted, moved, renamed, or written to in this repair.
- No old `user-data`, `session-data`, `cache`, `logs`, or `temp` directory was copied.
- Archived SHA-256: `EBC5EE9ED50FACD4CE592968C4605B4D926C26B7E3325694E2D8569D19C49627`, `B9003F2B56C6310B11EA039800F446A05C7FE1FBFE38577E06E26EEF62F4A0C0`, `A784A28E4E32656AC5EE4FE7C568CD5F49FB1BDDDF845AC6B9BC1424D33AB559`, `B6547271D0AAD8A0C34FC836068F81FA7503B162519735C509037198ED6D04AA`

### Project-root startup probe (current)

The current probe was created from the archived source under the exact project-root path:

`E:/fast_sheep/.tmp/sheep-301-ingress-startup-readiness`

Path derivation check: expected and actual candidate both resolve to `.tmp/sheep-301-ingress-startup-readiness` relative to `REPO_ROOT`; the sibling path is rejected as `PATH_OUTSIDE_REPO`; a parent-traversal candidate is rejected as `NOT_EXACT_PROBE_ROOT`.

Exact command:

`node E:/fast_sheep/.tmp/sheep-301-ingress-startup-readiness/run-probe.mjs`

Run result: exit `0`, signal `null`, Electron `43.6.0`, Chromium `150.0.7871.250`, Node `24.20.0`, sandbox `true`, no sandbox-disabling switch.

Observed scenarios:

1. Healthy concurrent startup: attach and `Network.enable` are initiated before first load; `did-start-navigation` occurs before enable resolution; `Network.webSocketCreated` is observed after enable resolution.
2. Bounded timeout: awaiting `Network.enable` before first navigation returns `TIMEOUT` after 2000 ms; navigation is then started and enable resolves after `did-start-navigation`.
3. Late attach: navigation and `dom-ready` occur before attach/enable; `Network.webSocketCreated` is missed while later handshake and frame events remain observable.

Observed event order:

`server:listening` -> `A:onViewCreated-start` -> `A:attach-start` -> `A:network-enable-sent` -> `A:loadURL-start` -> `A:did-start-navigation` -> `A:network-enable-resolved` -> `A:cdp:Network.webSocketCreated` -> `server:connection` -> `A:dom-ready` -> `A:did-finish-load` -> `A:load-and-enable-settled` -> `A:cdp:Network.webSocketWillSendHandshakeRequest` -> `server:message` -> `A:cdp:Network.webSocketHandshakeResponseReceived` -> `A:cdp:Network.webSocketFrameSent` -> `A:cdp:Network.webSocketFrameReceived` -> `A:onViewCreated-ready` -> `A:done` -> `B:attach-start` -> `B:network-enable-sent` -> `B:pre-navigation-enable-result` -> `B:loadURL-start-after-timeout-check` -> `B:did-start-navigation` -> `B:network-enable-resolved` -> `B:cdp:Network.webSocketCreated` -> `server:connection` -> `B:dom-ready` -> `B:did-finish-load` -> `B:enable-and-load-settled` -> `B:cdp:Network.webSocketWillSendHandshakeRequest` -> `B:cdp:Network.webSocketHandshakeResponseReceived` -> `B:cdp:Network.webSocketFrameSent` -> `server:message` -> `B:cdp:Network.webSocketFrameReceived` -> `B:done` -> `C:loadURL-start-before-observer` -> `C:did-start-navigation` -> `server:connection` -> `C:dom-ready` -> `C:dom-ready-before-observer` -> `C:attach-start` -> `C:network-enable-sent` -> `C:did-finish-load` -> `C:network-enable-resolved` -> `server:message` -> `C:cdp:Network.webSocketHandshakeResponseReceived` -> `C:cdp:Network.webSocketFrameSent` -> `C:cdp:Network.webSocketFrameReceived` -> `C:done`

Observed versus inferred:

- Observed: the ordering above, the bounded timeout, late-attach event loss, path rejection behavior, runtime versions, exit code, and cleanup exit.
- Inferred: the production `onViewCreated` contract and the requirement that missing `webSocketCreated` evidence must fail closed. These are design conclusions, not claims that every future run has identical timing.

Coverage limitation: pre-admission frames are DROPPED under the next-unit scope. Early messages are not collected; this probe and unit do not establish final production message completeness.

#### New probe source

`probe-main.mjs`

```javascript
import { app, BrowserWindow, WebContentsView } from "electron";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROBE_ROOT = process.env.SHEEP301_PROBE_ROOT ?? process.env.SHEEP301_STARTUP_PROBE_ROOT;
const REPO_ROOT = process.env.SHEEP301_REPO_ROOT;
if (!PROBE_ROOT || !REPO_ROOT) throw new Error("probe root and repo root are required");
const EXPECTED_PROBE_ROOT = resolve(REPO_ROOT, ".tmp", "sheep-301-ingress-startup-readiness");
const RESOLVED_PROBE_ROOT = resolve(PROBE_ROOT);
const PROBE_RELATIVE_TO_REPO = relative(REPO_ROOT, RESOLVED_PROBE_ROOT);
const PROBE_ROOT_INSIDE_REPO = PROBE_RELATIVE_TO_REPO !== "" && !PROBE_RELATIVE_TO_REPO.startsWith("..") && !isAbsolute(PROBE_RELATIVE_TO_REPO);
const PATH_CHECK = {
  ok: PROBE_ROOT_INSIDE_REPO && RESOLVED_PROBE_ROOT === EXPECTED_PROBE_ROOT,
  reason: PROBE_ROOT_INSIDE_REPO && RESOLVED_PROBE_ROOT === EXPECTED_PROBE_ROOT ? "OK" : (PROBE_ROOT_INSIDE_REPO ? "NOT_EXACT_PROBE_ROOT" : "PATH_OUTSIDE_REPO"),
  repoRoot: resolve(REPO_ROOT),
  candidate: RESOLVED_PROBE_ROOT,
  expected: EXPECTED_PROBE_ROOT,
  relativeToRepo: PROBE_RELATIVE_TO_REPO,
};
if (!PATH_CHECK.ok) { console.error("invalid startup probe root: " + JSON.stringify(PATH_CHECK)); process.exit(3); }
for (const name of ["user-data", "session-data", "cache", "temp", "logs"]) mkdirSync(join(RESOLVED_PROBE_ROOT, name), { recursive: true });
app.setPath("userData", join(RESOLVED_PROBE_ROOT, "user-data"));
app.setPath("sessionData", join(RESOLVED_PROBE_ROOT, "session-data"));
app.setPath("cache", join(RESOLVED_PROBE_ROOT, "cache"));
app.setPath("temp", join(RESOLVED_PROBE_ROOT, "temp"));
app.setAppLogsPath(join(RESOLVED_PROBE_ROOT, "logs"));
app.commandLine.appendSwitch("disable-gpu");

const PROBE_SOURCE_PATH = fileURLToPath(import.meta.url);
const PROBE_SOURCE_SHA256 = createHash("sha256").update(readFileSync(PROBE_SOURCE_PATH)).digest("hex");
const packageRequire = createRequire(join(REPO_ROOT, "packages", "platform-pdd", "package.json"));
const jsdomEntry = packageRequire.resolve("jsdom");
const jsdomRequire = createRequire(jsdomEntry);
const { WebSocketServer } = jsdomRequire("ws");

function progress(name) { appendFileSync(join(RESOLVED_PROBE_ROOT, "new-probe-progress.log"), `${Date.now()} ${name}\n`, "utf8"); }

let sequence = 0;
const events = [];
function record(name, detail = {}) {
  const entry = { sequence: ++sequence, name, monotonicMs: Number(process.hrtime.bigint() / 1000000n), wall: new Date().toISOString(), detail };
  events.push(entry);
  return entry;
}
function waitFor(predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) { clearInterval(timer); resolve(true); return; }
      if (Date.now() - started > timeoutMs) { clearInterval(timer); reject(new Error("timeout")); }
    }, 10);
  });
}
function once(emitter, name) {
  return new Promise((resolve) => emitter.once(name, (...args) => resolve(args)));
}
function hasEvent(name) { return events.some((entry) => entry.name === name); }
function firstIndex(name) { return events.findIndex((entry) => entry.name === name); }
function startServer() {
  return new Promise((resolve, reject) => {
    let port = 0;
    const server = createServer((request, response) => {
      if (request.url !== "/") { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end("<!doctype html><html><body><script>const ws=new WebSocket('ws://127.0.0.1:" + port + "/socket');ws.onopen=()=>{document.title='open';ws.send('probe-client');};ws.onmessage=()=>{document.title='message';};</script></body></html>");
    });
    const wsServer = new WebSocketServer({ server, path: "/socket" });
    wsServer.on("connection", (socket) => {
      record("server:connection");
      socket.on("message", () => record("server:message"));
      setTimeout(() => { try { socket.send("probe-server"); } catch {} }, 25);
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      record("server:listening", { port });
      resolve({ server, wsServer, port });
    });
  });
}
function attachDebuggerOnly(webContents, label) {
  record(label + ":attach-start");
  progress(label + ":attach-start");
  if (!webContents.debugger.isAttached()) webContents.debugger.attach("1.3");
  const listener = (_event, method, params, sessionId) => {
    if (method && method.startsWith("Network.webSocket")) {
      record(label + ":cdp:" + method, { requestId: params?.requestId, cdpSessionId: sessionId ?? "" });
    }
  };
  webContents.debugger.on("message", listener);
  record(label + ":network-enable-sent");
  progress(label + ":enable-sent");
  const enablePromise = webContents.debugger.sendCommand("Network.enable").then(() => {
    record(label + ":network-enable-resolved");
    progress(label + ":enable-resolved");
  });
  return { listener, enablePromise };
}
function bindLifecycle(webContents, label) {
  webContents.on("did-start-navigation", (_event, url, isInPlace, isMainFrame) => record(label + ":did-start-navigation", { url, isInPlace, isMainFrame }));
  webContents.on("dom-ready", () => record(label + ":dom-ready"));
  webContents.on("did-finish-load", () => record(label + ":did-finish-load"));
}
function cleanupView(window, view, handle) {
  try { if (handle?.listener) view.webContents.debugger.removeListener("message", handle.listener); } catch {}
  try { if (view.webContents.debugger.isAttached()) view.webContents.debugger.detach(); } catch {}
  try { window.contentView.removeChildView(view); } catch {}
  try { if (!view.webContents.isDestroyed()) view.webContents.close(); } catch {}
}
async function runScenarioA(window, url) {
  const view = new WebContentsView({ webPreferences: { partition: "memory:sheep301-startup-a-" + Date.now(), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  window.contentView.addChildView(view);
  bindLifecycle(view.webContents, "A");
  record("A:onViewCreated-start");
  const handle = attachDebuggerOnly(view.webContents, "A");
  record("A:loadURL-start");
  progress("A:loadURL-start");
  const loadPromise = view.webContents.loadURL(url);
  await Promise.allSettled([handle.enablePromise, loadPromise]);
  record("A:load-and-enable-settled");
  progress("A:load-and-enable-settled");
  await waitFor(() => hasEvent("A:did-finish-load") && hasEvent("A:cdp:Network.webSocketCreated"), 5000).catch(() => {});
  progress("A:wait-events-done");
  await new Promise((resolve) => setTimeout(resolve, 100));
  record("A:onViewCreated-ready");
  progress("A:onViewCreated-ready");
  record("A:done");
  return { view, handle };
}
async function runScenarioB(window, url) {
  const view = new WebContentsView({ webPreferences: { partition: "memory:sheep301-startup-b-" + Date.now(), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  window.contentView.addChildView(view);
  bindLifecycle(view.webContents, "B");
  const handle = attachDebuggerOnly(view.webContents, "B");
  const timeoutMs = 2000;
  const timeoutResult = new Promise((resolve) => setTimeout(() => resolve({ status: "TIMEOUT", timeoutMs }), timeoutMs));
  const enableSettled = handle.enablePromise.then(() => ({ status: "RESOLVED" }), (error) => ({ status: "REJECTED", error: String(error) }));
  const beforeNavigation = await Promise.race([enableSettled, timeoutResult]);
  record("B:pre-navigation-enable-result", beforeNavigation);
  record("B:loadURL-start-after-timeout-check");
  const loadPromise = view.webContents.loadURL(url);
  const afterNavigation = await Promise.allSettled([enableSettled, loadPromise]);
  record("B:enable-and-load-settled", { statuses: afterNavigation.map((entry) => entry.status) });
  await waitFor(() => hasEvent("B:did-finish-load"), 7000).catch(() => {});
  await waitFor(() => hasEvent("B:cdp:Network.webSocketCreated"), 7000).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 100));
  record("B:done");
  return { view, handle, beforeNavigation };
}
async function runScenarioC(window, url) {
  const view = new WebContentsView({ webPreferences: { partition: "memory:sheep301-startup-c-" + Date.now(), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  window.contentView.addChildView(view);
  bindLifecycle(view.webContents, "C");
  record("C:loadURL-start-before-observer");
  const loadPromise = view.webContents.loadURL(url);
  await once(view.webContents, "dom-ready");
  record("C:dom-ready-before-observer");
  const handle = attachDebuggerOnly(view.webContents, "C");
  await Promise.allSettled([handle.enablePromise, loadPromise]);
  await new Promise((resolve) => setTimeout(resolve, 150));
  record("C:done");
  return { view, handle };
}
async function main() {
  progress("main-start");
  await app.whenReady();
  progress("app-ready");
  const { server, wsServer, port } = await startServer();
  progress("server-ready");
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  const url = "http://127.0.0.1:" + port + "/";
  progress("scenario-a-start");
  const a = await runScenarioA(window, url);
  progress("scenario-a-done");
  progress("scenario-b-start");
  const b = await runScenarioB(window, url);
  progress("scenario-b-done");
  progress("scenario-c-start");
  const c = await runScenarioC(window, url);
  progress("scenario-c-done");
  const checks = {
    runtime: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
    sandbox: true,
    noSandboxSwitchUsed: false,
    scenarioA: {
      observerSetupStartedBeforeLoad: firstIndex("A:attach-start") < firstIndex("A:loadURL-start"),
      networkEnableSentBeforeLoad: firstIndex("A:network-enable-sent") < firstIndex("A:loadURL-start"),
      navigationStartedBeforeEnableResolved: firstIndex("A:did-start-navigation") < firstIndex("A:network-enable-resolved"),
      enableAndLoadSettledBeforeHookResolved: firstIndex("A:load-and-enable-settled") < firstIndex("A:onViewCreated-ready"),
      navigationStarted: hasEvent("A:did-start-navigation"),
      webSocketCreatedObserved: hasEvent("A:cdp:Network.webSocketCreated"),
      webSocketCreatedBeforeDomReady: firstIndex("A:cdp:Network.webSocketCreated") >= 0 && firstIndex("A:cdp:Network.webSocketCreated") < firstIndex("A:dom-ready"),
      mutualWaitExcluded: hasEvent("A:network-enable-resolved") && hasEvent("A:loadURL-start") && firstIndex("A:network-enable-resolved") > firstIndex("A:loadURL-start"),
    },
    scenarioB: {
      preNavigationEnableResult: events.find((entry) => entry.name === "B:pre-navigation-enable-result")?.detail ?? null,
      boundedTimeoutObserved: events.find((entry) => entry.name === "B:pre-navigation-enable-result")?.detail?.status === "TIMEOUT",
      navigationStartedAfterTimeout: firstIndex("B:pre-navigation-enable-result") < firstIndex("B:did-start-navigation"),
      enableResolvedAfterNavigation: firstIndex("B:did-start-navigation") < firstIndex("B:network-enable-resolved"),
    },
    scenarioC: {
      navigationStartedBeforeObserverAttach: firstIndex("C:did-start-navigation") < firstIndex("C:attach-start"),
      domReadyBeforeNetworkEnableSent: firstIndex("C:dom-ready") < firstIndex("C:network-enable-sent"),
      lateWebSocketCreatedObserved: hasEvent("C:cdp:Network.webSocketCreated"),
      lateObservationMissed: !hasEvent("C:cdp:Network.webSocketCreated"),
    },
    eventOrder: events.map((entry) => entry.name),
  };
  progress("result-write-start");
  writeFileSync(join(RESOLVED_PROBE_ROOT, "new-probe-result.json"), JSON.stringify({ probe: "SHEEP-301_INGRESS_STARTUP_READINESS", generatedAt: new Date().toISOString(), command: "node E:/fast_sheep/.tmp/sheep-301-ingress-startup-readiness/run-probe.mjs", source: { path: PROBE_SOURCE_PATH, sha256: PROBE_SOURCE_SHA256 }, pathCheck: PATH_CHECK, checks, events }, null, 2) + "\n", "utf8");
  cleanupView(window, a.view, a.handle);
  cleanupView(window, b.view, b.handle);
  cleanupView(window, c.view, c.handle);
  await new Promise((resolve) => wsServer.close(resolve));
  await new Promise((resolve) => server.close(resolve));
  if (!window.isDestroyed()) window.destroy();
  progress("result-written");
  app.exit(0);
}

main().catch((error) => {
  if (PATH_CHECK.ok) writeFileSync(join(RESOLVED_PROBE_ROOT, "new-probe-error.json"), JSON.stringify({ error: String(error?.stack ?? error), pathCheck: PATH_CHECK, source: { path: PROBE_SOURCE_PATH, sha256: PROBE_SOURCE_SHA256 }, events }, null, 2) + "\n", "utf8");
  app.exit(1);
});
```

`run-probe.mjs` (launcher and path validation)

```javascript
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, isAbsolute, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(fileURLToPath(import.meta.url), "..");
const REPO_ROOT = resolve(HERE, "..", "..");
const PROBE_ROOT = resolve(REPO_ROOT, ".tmp", "sheep-301-ingress-startup-readiness");
const PROBE_MAIN = resolve(PROBE_ROOT, "probe-main.mjs");

function validateRoot(candidate) {
  const resolvedRepo = resolve(REPO_ROOT);
  const resolvedCandidate = resolve(candidate);
  const rel = relative(resolvedRepo, resolvedCandidate);
  const inside = rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  return {
    ok: inside && resolvedCandidate === PROBE_ROOT,
    reason: inside && resolvedCandidate === PROBE_ROOT ? "OK" : (inside ? "NOT_EXACT_PROBE_ROOT" : "PATH_OUTSIDE_REPO"),
    resolvedRepo,
    resolvedCandidate,
    expected: PROBE_ROOT,
    relativeToRepo: rel,
  };
}

const pathCheck = validateRoot(PROBE_ROOT);
const siblingCheck = validateRoot(resolve(REPO_ROOT, "..", basename(REPO_ROOT) + ".tmp", "sheep-301-ingress-startup-readiness"));
const escapeCheck = validateRoot(resolve(REPO_ROOT, ".tmp", "..", "escape"));
if (!pathCheck.ok || siblingCheck.ok || escapeCheck.ok) {
  throw new Error("startup probe path policy failed: " + JSON.stringify({ pathCheck, siblingCheck, escapeCheck }));
}

const requireFromDesktop = createRequire(resolve(REPO_ROOT, "apps", "desktop", "package.json"));
const electronPath = requireFromDesktop("electron");
const probeSourceSha256 = createHash("sha256").update(readFileSync(PROBE_MAIN)).digest("hex");
const startedAt = new Date().toISOString();
const child = spawn(electronPath, ["--disable-gpu", PROBE_MAIN], {
  cwd: REPO_ROOT,
  stdio: "inherit",
  windowsHide: true,
  env: { ...process.env, SHEEP301_PROBE_ROOT: PROBE_ROOT, SHEEP301_REPO_ROOT: REPO_ROOT },
});
const timer = setTimeout(() => { child.kill(); process.exitCode = 2; }, 20000);
child.on("error", (error) => {
  clearTimeout(timer);
  writeFileSync(resolve(PROBE_ROOT, "new-probe-launcher-result.json"), JSON.stringify({ command: "node " + resolve(PROBE_ROOT, "run-probe.mjs"), exitCode: null, signal: null, pathCheck, siblingCheck, escapeCheck, electronPath, probeSourceSha256, startedAt, finishedAt: new Date().toISOString(), error: String(error) }, null, 2) + "\n", "utf8");
  process.exit(1);
});
child.on("exit", (code, signal) => {
  clearTimeout(timer);
  const result = { command: "node " + resolve(PROBE_ROOT, "run-probe.mjs"), exitCode: code, signal, pathCheck, siblingCheck, escapeCheck, electronPath, probeSourceSha256, startedAt, finishedAt: new Date().toISOString() };
  writeFileSync(resolve(PROBE_ROOT, "new-probe-launcher-result.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
  process.exit(signal ? 1 : (code ?? 1));
});
```

Evidence artifacts:

- `E:/fast_sheep/.tmp/sheep-301-ingress-startup-readiness/new-probe-result.json`
- `E:/fast_sheep/.tmp/sheep-301-ingress-startup-readiness/new-probe-launcher-result.json`
- `E:/fast_sheep/.tmp/sheep-301-ingress-startup-readiness/new-probe-progress.log`

Source SHA-256: `a502d82e548fc5680cd8b1500dbd9f621e459ab204572c2d0748e4a36877e7dc`. Launcher SHA-256: `a6c037b500bb7001285477314d532c81e14a600cd46a175ad8b4f885c757c44a`.

### Identity handover after pre-READY binding

- Immutable binding evidence is captured at Network.webSocketCreated: actual WebContents object, sessionId, shopId, documentGeneration, observer lifecycle, allowed URL/origin, cdpSessionId, requestId, and creation observation time.
- Pre-READY, the observer may save only the immutable connection binding. Every frame received before independent Main admission is DROPped with a bounded diagnostic reason such as EARLY_FRAME_WITHOUT_ADMISSION. No frame queue, buffer release, replay, or retry is added. It must not call createInboundIngressContext, map identity, canonicalize content, create associations, or write owner evidence.
- If Network.webSocketCreated was not observed for a requestId, every frame with that requestId is rejected/dropped as UNBOUND_OR_STALE_SOURCE. Current WebContents/session/document state must never be used to infer a missing connection.
- Early frames are not processed. After READY and a granted independent Main admission, createInboundIngressContext is called for the exact WebContents. The existing resolveInboundIngressBinding result supplies sessionId, shopId, and documentGeneration; actual WebContents object equality must be checked by the Main-owned admission record/service because its return type does not include WebContents.
- A binding/context mismatch, missing admission, denied admission, or stale admission rejects the input. There are no queued frames to release. The old connection is never assigned the current document generation.
- New frames after permission are accepted only against a pre-existing requestId binding from the same current lifecycle. Old-generation, detached, destroyed, or terminal events are dropped/STOPPED.

### Main admission contract

The implemented unit uses a Main-owned admission provider. Production default is DENY_ALL. The implementation remains AWAITING_CONTROLLER_REVIEW.

Proposed Main-only types:

    PddMainAdmissionRequest {
      webContents: WebContents;
      sessionId: string;
      shopId: string;
      documentGeneration: number;
      observerLifecycleId: number;
      connectionEvidenceHash: string;
    }

    PddMainAdmissionDecision =
      | { granted: true; admissionId: string }
      | { granted: false; reason: string }

    PddMainAdmissionProvider.evaluate(request): PddMainAdmissionDecision

Implemented Main-only service method:

    handleAdmittedInboundIngress(sender, context, admissionId, input, request): PddInboundIngressResult

Ownership and validation:

- Main composition owns the provider; renderer/page/payload/DOM READY cannot create or refresh admission.
- The service validates trusted sender and opaque context first.
- The provider evaluates actual WebContents, sessionId, shopId, documentGeneration, observer lifecycle, and immutable connection evidence.
- granted=true and a live admissionId are required before the existing handleTrustedInboundIngress(sender, context, input) is called.
- The actual WebContents object identity must be retained by the Main admission record; resolveInboundIngressBinding alone is not sufficient because it returns only sessionId, shopId, and documentGeneration.
- Missing, denied, thrown, stale, or revoked admission returns STOPPED/REJECTED with canonical ingress and collector counts zero.
- Admission is invalidated by navigation/generation change, detach, destroyed WebContents, dispose/recreate, reauth, terminal lifecycle, or provider revocation.
- page_ready and other page/renderer events may update sender-owned session state only; they cannot grant, refresh, or extend admission.

### Legacy isolation design

- Add PddPlatformServiceOptions.canonicalIngressMode with production default DISABLED and a separate LEGACY mode for existing compatibility behavior.
- page_ready, login_required, dom_unsupported, and related state events may update PddSessionHost state, but cannot create a connection binding or authorize canonical output.
- When mode is CANONICAL_CONTROLLED or DISABLED, message_received, human_reply_detected, and conversation_changed must not invoke onInboundMessage, PddOrchestratorBridge, AI, persistence, or send.
- Initialization without a successfully armed observer keeps canonical admission false and legacy fallback disabled.
- Attach/enable/resolver/validator/mapper/collector failure returns directly with no retry and no legacy fallback.
- Detach, destruction, dispose, or terminal lifecycle clears bindings and keeps both canonical admission and legacy business consumers off.
- Planned files for this isolation are pdd-platform-service.ts, pdd-page-ipc.ts, main/index.ts, bootstrap.ts, and worker-runtime.ts.

### Gap table

| Gap | Current state and source | Impact on next unit | Required change | Offline verification | Live dependency | Classification |
|---|---|---|---|---|---|---|
| GAP-R1 | No Main-owned observer exists in PddPlatformService.activate / PddSessionHost.createAndLoad; view is created before load. | No attachment point before the first possible connection. | Add an onViewCreated startup hook that attaches Debugger and sends Network.enable, then returns a startup handle without awaiting enable or navigation. Activation starts first navigation and awaits the enable/navigation barrier concurrently. | Startup ordering probe plus attach/enable failure and cancellation tests. | No for mechanism; yes for real PDD events. | CONFIRMED / TODO_IMPLEMENTATION |
| GAP-R2 | PddViewHost starts page observation after dom-ready; PddPageRuntime emits page_ready only after DOM health. | Connection-created events may occur before attach or READY and are not replayed. | Arm observation before load; bind requestId at webSocketCreated; DROP all pre-admission frames and record the reason. Do not queue, replay, or require READY to create the immutable connection binding. | Early connection/frame ordering test plus startup probe. | Yes for real PDD timing. | CONFIRMED / TODO_IMPLEMENTATION |
| GAP-R3 | READY is produced by domHealth over PDD_SELECTOR_PROFILE; required selectors are DESIGN provenance. | READY is not proven production authentication/session-health truth. | Separate connection-bound from canonical-output-allowed; require a Main-owned readiness policy before output. | Controlled readiness stub; production default-off test. | Yes for real session-health evidence. | CONFIRMED / BLOCKED_FOR_PRODUCTION |
| GAP-R4 | bootstrap.ts constructs PddPlatformService without resolver/collector; worker-runtime supplies repositories but no PDD ingress wiring. | Accepted canonical ingress cannot be composed in production. | Add explicit resolver/collector injection options and controlled composition wiring. | Composition tests with controlled resolver/collector. | No for wiring; yes for real facts. | CONFIRMED / TODO_IMPLEMENTATION |
| GAP-R5 | workspaceMerchant, StoreRepository, and PlatformAccountRepository are separate authorities; no runtime Shop mapping exists. | Runtime Shop cannot automatically equal canonical Store or PlatformAccount. A controlled mapping or legal UNKNOWN is sufficient for the next unit; no Owner decision is required now. | Use explicit trusted mapping when available; otherwise UNKNOWN/UNRESOLVED or reject according to contract. | Same-ID and missing-mapping isolation tests. | Potentially yes for real external identity facts. | CONFIRMED / CONTROLLED_MAPPING_OR_LEGAL_UNKNOWN |
| GAP-R6 | pdd-page-ipc receives sender but main/index.ts drops it; handlePageEvent routes by payload session_id/shop_id. | Legacy path is not sender-bound and can cross-route within trusted PDD WebContents. | Pass sender into the selected path and bind it to the owning session; do not reuse payload-only routing. | Same-service forged sender/session/shop tests. | No. | CONFIRMED / TODO_IMPLEMENTATION |
| GAP-R7 | Legacy message_received -> handleInbound -> onInboundMessage/PddOrchestratorBridge remains independent. | New and legacy consumers can both process inbound traffic or a failure can fall back to AI/send. | Add a default-off selected-path gate; make legacy bridge unreachable for canonical success and failure. | Legacy-call counter and collector-count negatives. | No. | CONFIRMED / TODO_IMPLEMENTATION |
| GAP-R8 | pdd-page-ipc accepts payload when eventValidator is unavailable. | Malformed legacy page events can pass if that route is reused. | Fail closed when validator unavailable for a selected path; otherwise keep the legacy route isolated. | Validator-unavailable negative test. | No. | CONFIRMED / TODO_IF_REUSED |
| GAP-R9 | Diagnostic observer terminates a WebContents permanently; production recovery policy is absent and PddPlatformService reuses the session map. | Terminal STOP plus new WebContents is sufficient for the next controlled unit; same-WebContents recovery is not required now. | Keep terminated WebContents STOPPED; require a new WebContents for the next lifecycle. Defer long-term recovery policy. | New-WebContents positive and same-WebContents negative tests. | Yes for real reconnect/replay later. | CONFIRMED / DEFERRED_PRODUCTION_RECOVERY / NOT_BLOCKING_CURRENT_DESIGN |
| GAP-R10 | PddCanonicalIdentityBinding.association is optional; no trusted production association resolver is wired. | Internal conversation/local message may remain UNKNOWN. | Keep UNKNOWN/UNRESOLVED; do not create or rewrite association ownership after receipt. | Existing controlled association tests; no persistence write. | No for minimal mapping. | LEGAL_UNKNOWN / DEFERRED |
| GAP-R11 | normalizeSourceOccurredAt returns null plus diagnostics for missing/invalid values. | Source time is not a general blocker to minimal mapping. | Preserve valid business time or null; never use receipt time or CDP MonotonicTime. | Existing source-time regression set. | Yes for real source-time semantics. | DEFERRED_LIVE |
| GAP-R12 | Only synthetic loopback proof exists; no real PDD/Titan evidence. | Actual URL/origin, framing, compression, fragmentation, reconnect/replay, and real time remain unverified. | Keep live separately authorized; do not infer platform behavior from loopback. | Not possible for real platform behavior. | Yes; future minimal live observation with STOP. | BLOCKED_FOR_PRODUCTION / LIVE_REQUIRED |

### Canonical field audit

- runtime shop: actual WebContents -> PddSessionHost binding; payload self-report is not authority.
- merchant/store/platform account: repository facts exist, but no runtime-Shop-to-canonical mapping exists; use explicit resolver or UNKNOWN/UNRESOLVED.
- CDP sessionId/requestId: CDP debugging/connection identifiers only; not PDD session, document generation, conversation, customer, or platform message identity.
- customer: platformCustomerId from normalized from.uid; missing is UNKNOWN, present-invalid rejects.
- platform message identity: from normalized msg_id; missing is UNKNOWN, never a fingerprint or fallback ID.
- internal conversation/local message: only trusted association evidence; missing remains UNKNOWN/UNRESOLVED.
- content: canonical normalizer preserves exact text; legacy DOM path trims and can truncate context blocks, so do not reuse it as the producer.
- selected customer: runtime evidence only; never fills platformCustomerId.
- sourceOccurredAt: nullable with diagnostics; do not substitute receipt time.

### Recommended next acceptance unit

TRUSTED_MAIN_PDD_INGRESS_PRODUCER_WIRING.

Sole objective: wire one default-off Main-owned PDD producer from one controlled WebContents into the accepted canonical ingress with explicit scope/identity resolvers and a controlled collector, while keeping the legacy bridge unreachable and production output disabled.

Proposed file scope for review:

- apps/desktop/src/main/platforms/pdd/pdd-platform-service.ts
- apps/desktop/src/main/platforms/pdd/pdd-session-host.ts
- apps/desktop/src/main/platforms/pdd/pdd-page-ipc.ts
- apps/desktop/src/main/platforms/pdd/pdd-inbound-observer.ts (new)
- apps/desktop/src/main/platforms/pdd/pdd-main-admission.ts (new)
- apps/desktop/src/main/bootstrap.ts
- apps/desktop/src/main/worker-runtime.ts
- apps/desktop/src/main/index.ts only if a sender-bearing PDD path is selected
- apps/desktop/tests/pdd-inbound-observer.test.ts (new)
- apps/desktop/tests/pdd-platform-service.test.ts
- apps/desktop/tests/pdd-page-ipc-guard.test.ts
- apps/desktop/tests/bootstrap-pdd-ingress-wiring.test.ts (new)

Main wiring: create the observer in PddPlatformService.activate on onViewCreated. The hook may be async for attach/setup, but it must resolve after Debugger.attach and initiating Network.enable without awaiting enable resolution or first navigation. It returns a startup handle. Activate starts first navigation, then awaits the handle armed promise concurrently with load. Bind requestId at Network.webSocketCreated using the current Main document generation; before READY, store only immutable connection evidence and DROP every pre-admission frame. After READY and a granted independent Main admission, create the canonical context for the exact WebContents and require resolveInboundIngressBinding to match the frozen connection binding before mapping.

Default-off gate: add PddPlatformServiceOptions.canonicalIngressMode with DISABLED as the production default. page_ready and other session-state events cannot authorize canonical output by themselves. Only an explicitly armed observer plus a valid immutable connection binding plus READY plus granted Main admission may open canonical output. In CANONICAL_CONTROLLED or DISABLED mode, handlePageEvent must not invoke legacy message_received/human_reply_detected/conversation_changed business consumers. Resolver, validator, mapper, or collector failure returns directly and never falls back to PddOrchestratorBridge.

Minimum acceptance:

- Positive: one controlled WebContents/connection/text frame maps once through the real mapper/default validator; two same-service sessions remain isolated; explicit scope/identity resolver is used.
- Startup: probe asserts attach and Network.enable are sent before load, did-start-navigation precedes enable resolution, and Network.webSocketCreated is observed after enable; awaiting enable before navigation is a regression.
- Negative: observer armed + binding valid + session READY but Main admission missing/denied/throws/stale => canonical ingress and collector calls are zero; old page_ready cannot change that result.
- Negative: missing Network.webSocketCreated evidence, pre-admission frame, old terminal WebContents, same-WebContents restart, wrong CDP session/requestId, stale generation, forged/missing context, and wrong sender all stop before canonical ingress.
- Failure: attach/enable failure cleans up; missing resolver/validator/collector and collector sync/async failure stop without legacy fallback, retry, AI, send, or persistence.
- Composition: production default is DISABLED and Main admission default is DENY_ALL; controlled activation, resolver, admission provider, and collector are explicit; legacy bridge counters remain zero during initialization, failure, detach, and termination.
- Coverage: pre-admission frames are DROPPED and disclosed as not collected; no queue, replay, retry, or final message-completeness claim.

STOP boundary: controlled Main composition and collector only. No live PDD/Titan, real seller session, production IPC observer channel, AI, persistence, send, HUMAN_CONFIRM, AUTO, or platform mutation. Do not approve same-WebContents recovery.

Out of scope: real PDD/Titan compatibility, production activation, durable dedupe/observedAt, association creation, later SHEEP tasks.

Contribution to full SHEEP-301: closes the missing Main-owned controlled producer/composition and legacy-isolation gap. It does not close real readiness evidence, real identity mapping, real Titan framing/time, or production activation.

### Live evidence boundary

- URL/origin and actual PDD connection: affects observer allowlist shape; controlled URL can be synthetic; real behavior requires future live observation.
- Text/binary framing, compression, fragmentation: cannot be answered by the loopback proof; requires future minimal live evidence before production mapping claims.
- Reconnect/replay and duplicate behavior: recovery and duplicate handling must remain conservative; real behavior is future live work.
- Business sourceOccurredAt: keep null plus diagnostics; real semantics require future live evidence.
- Real store/platform-account/customer facts: do not infer; require explicit trusted mapping or future authorized observation.

AUDIT_RESULT: COMPLETE
NEXT_UNIT_IMPLEMENTATION_READINESS: READY_WITH_CONSTRAINTS
PRODUCTION_PDD_INGRESS_READINESS: BLOCKED
LIVE_VALIDATION_AUTHORIZATION: NOT_AUTHORIZED
CONTROLLER_REVIEW_STATUS: AWAITING_CONTROLLER_REVIEW
implementation_performed = false
implementation_authorized = false
live_validation_performed = false
full_sheep_301_closed = false
next_stage_not_executed = true

---

## 21. Trusted Main PDD Ingress Producer Wiring Result (ef9fef6)

- Task: SHEEP-301.
- Acceptance unit: TRUSTED_MAIN_PDD_INGRESS_PRODUCER_WIRING.
- Mode: BOUNDED_IMPLEMENTATION_AND_OFFLINE_VALIDATION.
- Readiness audit decision: PASS at reviewed commit ef9fef6c84797c3f31684d999a58fd61b978a501.
- Authorization: AUTHORIZED WITH CONSTRAINTS for this unit only.
- Source implementation: PERFORMED.
- Controlled offline validation: PERFORMED.
- Production activation: NOT PERFORMED.
- Live validation: NOT PERFORMED / NOT AUTHORIZED.
- Full SHEEP-301: PARTIAL / OPEN.
- Controller review status for this unit: AWAITING_CONTROLLER_REVIEW.

### Implemented boundary

The implementation adds Main-owned canonical ingress mode, connection binding, observer lifecycle, Main admission, and sender-bearing legacy isolation without changing canonical schemas or dependencies.

Implemented product files:

- apps/desktop/src/main/platforms/pdd/pdd-platform-service.ts
- apps/desktop/src/main/platforms/pdd/pdd-session-host.ts
- apps/desktop/src/main/platforms/pdd/pdd-page-ipc.ts
- apps/desktop/src/main/platforms/pdd/pdd-inbound-observer.ts
- apps/desktop/src/main/platforms/pdd/pdd-main-admission.ts
- apps/desktop/src/main/bootstrap.ts
- apps/desktop/src/main/worker-runtime.ts (existing composition pass-through preserved)
- apps/desktop/src/main/index.ts

### Controlled Electron loopback result

New smoke command:

node scripts/run-sheep-301-producer-wiring-smoke.mjs

Report:

reports/SHEEP-301-producer-wiring-report.json

Result: COMPLETE.

Required checks:

- W01: production-facing service defaults to DISABLED and DENY_ALL.
- W02: two real WebContents sessions activate under one PddPlatformService.
- W03: a pre-admission frame is dropped with zero collector growth.
- W04: the same bound connection maps after Main admission.
- W05: two shops using the same opaque customer/message IDs remain scope-isolated.
- W06: revoked admission blocks later frames on the same connection.
- W07: admission cannot be reused across WebContents/scope/connection evidence.
- W08: legacy bridge, AI, transport send, and business persistence counters are zero.
- W09: required unit regressions pass.

Runtime and isolation:

- Electron 43.6.0.
- Chromium 150.0.7871.250.
- Node 24.20.0.
- sandbox = true.
- contextIsolation = true.
- nodeIntegration = false.
- webSecurity = true.
- no sandbox-disabling switch.
- two distinct non-persistent memory sessions.
- two real local WebSocket connections.
- two controlled collector envelopes.

Counters:

- legacyBridgeCalls = 0.
- aiCalls = 0.
- transportSendCalls = 0.
- businessPersistenceWrites = 0.
- syntheticWebSocketTraffic connections = 2, commandsReceived = 4, framesSent = 4.

### Coverage limitation

Pre-admission frames are DROPPed and recorded. They are not queued, replayed, retried, or collected. This unit therefore does not claim final production message completeness.

Real PDD/Titan behavior, production activation, business persistence, AI, send, HUMAN_CONFIRM, AUTO, and platform mutation remain unverified and NOT AUTHORIZED.

AUDIT_RESULT: COMPLETE
NEXT_UNIT_IMPLEMENTATION_READINESS: IMPLEMENTED / AWAITING_CONTROLLER_REVIEW
PRODUCTION_PDD_INGRESS_READINESS: BLOCKED
LIVE_VALIDATION_AUTHORIZATION: NOT_AUTHORIZED
full_sheep_301_closed = false
next_stage_not_executed = true
