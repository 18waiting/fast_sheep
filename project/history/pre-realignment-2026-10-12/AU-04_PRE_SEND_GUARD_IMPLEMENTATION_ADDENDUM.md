# AU-04 Addendum — PreSendGuard Implementation Scope

> **状态:** AU04I_PASS_CLOSED / AU04S_REPAIR_APPLIED_AWAITING_CONTROLLER_REVIEW / TRANSPORT_NOT_AUTHORIZED
> **日期:** 2026-10-03
> **关联计划:** `project/AU-04_PRE_SEND_GUARD_PLAN.md`
> **关联决策包:** `project/AU-04_PRE_SEND_GUARD_DECISION_PACKAGE.md`
> **Planning Review:** `PASS / CLOSED (PLANNING_ONLY)`
> **唯一不变量:** PreSendGuard 通过前，任何发送路径都不能调用 Transport。
> **实现授权:** `CONTRACT_AND_PURE_GUARD_ONLY`
> **验收报告:** `reports/AU-04I-pre-send-guard-contract-report.json`

---

## 1. What “PreSendGuard Implementation” Means

PreSendGuard 实现不是 AI 生成，也不是 Transport 发送。它是一道确定性的发送前安全门：

```text
ExecutionIntent.expected
        must equal
AdapterIdentityEvidence.actual

WrongTargetValidator + BindingValidator
        both mandatory

missing / conflicting / stale / unreadable
        = DENY
```

它只回答一个问题：

> 现在准备发送的目标，是否与之前批准的目标完全一致？

---

## 2. Implementation Deliverables

若后续单独授权实现，建议包括：

### 2.1 Guard Contract

- `PreSendGuardRequest`
- `PreSendGuardResult`
- `PreSendGuardDenyReason`
- `PreSendGuardAuditRecord`
- allow/deny result semantics

### 2.2 AdapterEvidence Boundary

- `AdapterIdentityEvidence`
- complete/partial/unreadable availability
- observed_at and freshness semantics
- evidence provenance
- platform-specific collection stays inside the Adapter

### 2.3 Guard Implementation

- Load ExecutionIntent by intent reference.
- Validate intent hash, expiry, state, and consumption.
- Read current Adapter evidence.
- Reject missing, partial, or unreadable evidence.
- Force WrongTargetValidator.
- Force BindingValidator.
- Compare every required expected field with actual evidence.
- Return deterministic allow/deny with reason codes.
- Emit audit correlation.

### 2.4 Orchestrator Integration

Future insertion point:

```text
ConversationOrchestrator.performSend()
-> PreSendGuard.evaluate(...)
-> DENY: SendFailed + audit + return
-> ALLOW: claim + SendStarted
-> SegmentedSender
-> PlatformAdapter.sendText
```

This integration is not authorized now.

### 2.5 Adapter Integration

Future Adapter work must expose enough current evidence:

- shop/store scope
- platform and platform account
- customer identity
- conversation identity
- trigger message
- session generation
- document generation
- evidence source and observation time

This integration is not authorized now.

### 2.6 Tests

Required positive tests:

- valid expected and actual identity allows.
- valid plan/policy/confirmation allows.
- one audit chain is produced.

Required negative tests:

- missing expected.
- missing actual.
- partial/unreadable evidence.
- cross-shop.
- cross-platform-account.
- cross-customer.
- cross-conversation.
- stale trigger message.
- expired intent.
- invalid intent hash.
- already consumed intent.
- confirmation replay.
- session generation mismatch.
- document generation mismatch.
- plan/policy mismatch.
- WrongTargetValidator bypass.
- BindingValidator bypass.
- caller-injected identity.

---

## 3. What It Is Not

- Not AI generation.
- Not PDD DOM control.
- Not Platform Transport.
- Not a real-send authorization.
- Not an AUTO authorization.
- Not a production enablement switch.

---

## 4. Required Decisions Before Full Implementation

```text
AD-05: session_generation authoritative producer
AD-06: document_generation authoritative producer
AD-07: Adapter evidence freshness window
AD-08: atomic intent claim owner / future unit
```

AD-05, AD-06, AD-07 remain `PRODUCT_DECISION_REQUIRED` for full send-path implementation.

---

## 5. Suggested Implementation Split

To preserve one invariant per acceptance unit:

### AU-04I — Guard Contract and Pure Logic

Allowed:

- guard types
- deterministic comparison logic
- synthetic AdapterEvidence
- unit and negative tests
- no send-path wiring

### AU-04S — Send-Path Integration

Requires separate authorization:

- Orchestrator integration
- Adapter evidence producer
- mandatory guard invocation
- integration tests
- no real send or AUTO

This split prevents a pure contract implementation from silently expanding into send-path execution.

---

## 6. Authorization Statement Required

To begin implementation, Controller must explicitly state the scope, for example:

```text
AU-04 Implementation: AUTHORIZED
Scope: CONTRACT_AND_PURE_GUARD_ONLY
Send Path Integration: NOT_AUTHORIZED
Transport Integration: NOT_AUTHORIZED
Real Send: NOT_AUTHORIZED
AUTO: NOT_GRANTED
```

or:

```text
AU-04 Implementation: AUTHORIZED
Scope: SEND_PATH_INTEGRATION
```

Only the scope explicitly written by Controller may be implemented.

---

## 7. AU-04S Implementation Record — 2026-10-03

```text
AU-04S RESULT: COMPLETE
Controller Review: PENDING (DEC-022 值域内尚无决定)
Unit State: REPAIR_APPLIED_AWAITING_CONTROLLER_REVIEW (引用 PROJECT_STATE.json remediation_program.current_unit_state)
Scope: SEND_PATH_INTEGRATION

Guard integration: IMPLEMENTED
Transport Integration: NOT_AUTHORIZED
Real Send: NOT_AUTHORIZED
AUTO: NOT_GRANTED
```

已接入 `ConversationOrchestrator.performSend()`：

- `preSendGuardRequired=true` 时必须配置 Guard 和 request factory。
- 缺少 Guard、request factory 返回 null、或 Guard deny 时，在 `SendStarted` 前终止。
- Guard allow 后才继续原有发送流程。
- 默认 `preSendGuardRequired=false` 时保留原行为，便于后续渐进启用。
- Adapter evidence producer、Transport、真实发送和 AUTO 未接入。
