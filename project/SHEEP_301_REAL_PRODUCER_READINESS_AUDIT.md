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
- Baseline: 0412a7d8c2497b9f15703f5aac1ec0ffcdcfb578.
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

### Gap table

| Gap | Current state and source | Impact on next unit | Required change | Offline verification | Live dependency | Classification |
|---|---|---|---|---|---|---|
| GAP-R1 | No Main-owned observer exists in PddPlatformService.activate / PddSessionHost.createAndLoad; view is created before load. | No attachment point before the first possible connection. | Create an observer factory at onViewCreated before load; own it per WebContents/session/document generation. | Fake-WebContents unit plus controlled Electron loopback. | No for mechanism; yes for real PDD events. | CONFIRMED / TODO_IMPLEMENTATION |
| GAP-R2 | PddViewHost starts page observation after dom-ready; PddPageRuntime emits page_ready only after DOM health. | Connection-created events may occur before attach or READY and are not replayed. | Attach and Network.enable before load; bind connection identity at creation; do not require READY to bind. | Early synthetic connection ordering test. | Yes for real PDD timing. | CONFIRMED / TODO_IMPLEMENTATION |
| GAP-R3 | READY is produced by domHealth over PDD_SELECTOR_PROFILE; required selectors are DESIGN provenance. | READY is not proven production authentication/session-health truth. | Separate connection-bound from canonical-output-allowed; require a Main-owned readiness policy before output. | Controlled readiness stub; production default-off test. | Yes for real session-health evidence. | CONFIRMED / BLOCKED_FOR_PRODUCTION |
| GAP-R4 | bootstrap.ts constructs PddPlatformService without resolver/collector; worker-runtime supplies repositories but no PDD ingress wiring. | Accepted canonical ingress cannot be composed in production. | Add explicit resolver/collector injection options and controlled composition wiring. | Composition tests with controlled resolver/collector. | No for wiring; yes for real facts. | CONFIRMED / TODO_IMPLEMENTATION |
| GAP-R5 | workspaceMerchant, StoreRepository, and PlatformAccountRepository are separate authorities; no runtime Shop mapping exists. | Runtime Shop cannot automatically equal canonical Store or PlatformAccount. | Use explicit trusted mapping; otherwise UNKNOWN/UNRESOLVED or reject according to contract. | Same-ID and missing-mapping isolation tests. | Potentially yes for real external identity facts. | CONFIRMED / PRODUCT_DECISION_REQUIRED |
| GAP-R6 | pdd-page-ipc receives sender but main/index.ts drops it; handlePageEvent routes by payload session_id/shop_id. | Legacy path is not sender-bound and can cross-route within trusted PDD WebContents. | Pass sender into the selected path and bind it to the owning session; do not reuse payload-only routing. | Same-service forged sender/session/shop tests. | No. | CONFIRMED / TODO_IMPLEMENTATION |
| GAP-R7 | Legacy message_received -> handleInbound -> onInboundMessage/PddOrchestratorBridge remains independent. | New and legacy consumers can both process inbound traffic or a failure can fall back to AI/send. | Add a default-off selected-path gate; make legacy bridge unreachable for canonical success and failure. | Legacy-call counter and collector-count negatives. | No. | CONFIRMED / TODO_IMPLEMENTATION |
| GAP-R8 | pdd-page-ipc accepts payload when eventValidator is unavailable. | Malformed legacy page events can pass if that route is reused. | Fail closed when validator unavailable for a selected path; otherwise keep the legacy route isolated. | Validator-unavailable negative test. | No. | CONFIRMED / TODO_IF_REUSED |
| GAP-R9 | Diagnostic observer terminates a WebContents permanently; production recovery policy is absent and PddPlatformService reuses the session map. | Same-WebContents recovery must not become an accidental production default. | Define new-WebContents recreation or an explicit recovery contract; default fail closed. | New-WebContents positive and same-WebContents negative tests. | Yes for real reconnect/replay later. | CONFIRMED / PRODUCT_DECISION_REQUIRED |
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
- apps/desktop/src/main/platforms/pdd/pdd-inbound-observer.ts (new)
- apps/desktop/src/main/bootstrap.ts
- apps/desktop/src/main/worker-runtime.ts
- apps/desktop/src/main/index.ts only if a sender-bearing PDD path is selected
- apps/desktop/tests/pdd-inbound-observer.test.ts (new)
- apps/desktop/tests/pdd-platform-service.test.ts
- apps/desktop/tests/bootstrap-pdd-ingress-wiring.test.ts (new)

Main wiring: create the observer in PddPlatformService.activate on onViewCreated, before session.createAndLoad/loadProductionEntry. The observer must attach Debugger and Network.enable before load, bind requestId at connection creation, and pass only a Main-validated context plus frozen inbound input to handleTrustedInboundIngress. Do not copy the diagnostic observer into production.

Default-off gate: add PddPlatformServiceOptions.canonicalIngressMode with DISABLED as the production default. Only an explicit controlled mode may create the observer and call handleTrustedInboundIngress. When that selected path is active, handlePageEvent must not independently invoke the legacy message_received -> handleInbound branch. Resolver, validator, mapper, or collector failure returns directly and never falls back to PddOrchestratorBridge.

Minimum acceptance:

- Positive: one controlled WebContents/connection/text frame maps once through the real mapper/default validator; two same-service sessions remain isolated; explicit scope/identity resolver is used.
- Negative: early connection, old terminal WebContents, same-WebContents restart, wrong CDP session/requestId, stale generation, forged/missing context, and wrong sender all stop before canonical ingress.
- Failure: attach/enable failure cleans up; missing resolver/validator/collector and collector sync/async failure stop without legacy fallback, retry, AI, send, or persistence.
- Composition: production default is DISABLED; controlled activation, resolver, and collector are explicit; legacy bridge counters remain zero.

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
