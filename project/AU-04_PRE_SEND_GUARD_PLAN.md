# AU-04 — PreSendGuard Fail-Closed Planning

> **状态:** CONTROLLER_PASS / CLOSED / AU04S_NOT_AUTHORIZED
> **日期:** 2026-10-03
> **决策包:** `project/AU-04_PRE_SEND_GUARD_DECISION_PACKAGE.md`
> **验收报告:** `reports/AU-04-pre-send-guard-planning-report.json`
> **实现附录:** `project/AU-04_PRE_SEND_GUARD_IMPLEMENTATION_ADDENDUM.md`
> **前置:** AU-03 `PASS / CLOSED`；ExecutionIntent contract implemented.
> **唯一不变量:** 任一 required identity 缺失、冲突、陈旧或不可读时，发送必须被拒绝，且 BindingValidator 不能被绕过。
> **授权范围:** Planning only.
> **明确禁止:** 修改发送路径、接入 Transport、真实发送、AUTO、生产启用。

---

## 1. Goal

设计一个确定性的 `PreSendGuard`，让现有发送链路在接入前能够：

1. 只从不可变 `ExecutionIntent` 取得 expected identity。
2. 从当前平台运行时读取 live Adapter evidence。
3. 对每个 required 字段执行 expected 与 actual 的单向比较。
4. 同时强制调用 `WrongTargetValidator` 和 `BindingValidator`。
5. 任一缺失、冲突、过期、不可读或状态不合法时 fail closed。
6. 生成可审计的拒绝或放行记录。

本单元只形成方案、接口边界、失败矩阵、测试矩阵和接入计划，不实现发送路径改动。

---

## 2. Current Evidence

```text
CONFIRMED:
- ExecutionIntent contract exists and is exported by @fastwork/domain.
- ExecutionIntent is not yet wired into ConversationOrchestrator.
- performSend currently receives SendRequest with shopId, conversationId, reply, generation, mode.
- WrongTargetValidator currently skips comparison when expected values are absent.
- BindingValidator exists but is not called by performSend.
- PlatformAdapter.sendText currently receives only shopId, conversationId, and segments.
- PlatformAdapter.getCurrentConversationState currently exposes lastMessageId and hasNewMessage.
- A complete Adapter identity evidence contract does not yet exist.

INFERRED:
- PreSendGuard must be a single mandatory entry point before segmented sending.
- The guard must consume an immutable intent by reference, not reconstruct expected identity from the current send request.
- Adapter evidence reads may be asynchronous and can fail; unreadable evidence must be a denial state.

PRODUCT_DECISION_REQUIRED:
- Authoritative producer for session generation.
- Authoritative producer for document generation.
- Whether Adapter evidence is read once per send attempt or per segment.
- How transport failure after guard approval is represented without weakening target proof.

BLOCKED:
- Full guard implementation requires later authorization to modify the send path.
- Adapter evidence integration requires a later platform/runtime task.

DEFERRED:
- Orchestrator integration.
- Platform Adapter evidence implementation.
- One-time intent claim and send-attempt persistence.
- Real send and AUTO.
```

---

## 3. Conceptual Contract

### Expected side

```text
ExecutionIntent
- identity_lock
- plan_ref
- policy_ref
- confirmation_ref?
- session_generation
- document_generation
- expires_at
- state
- intent_hash
```

### Actual side

```text
AdapterIdentityEvidence
- observed_at
- shop_id / store scope evidence
- platform
- platform_account_id
- customer_identity
- conversation_id
- trigger_message_id
- session_generation?
- document_generation?
- source / provenance
```

The exact field names remain a planning decision; the invariant is that every required expected field has an actual evidence source.

---

## 4. Guard Algorithm

Proposed deterministic order:

```text
1. Receive intent_id, not a caller-built identity object.
2. Load the immutable ExecutionIntent.
3. Validate intent structure, expiry, state, and hash.
4. Reject if intent is already CLAIMED/ATTEMPTED/terminal.
5. Read live AdapterIdentityEvidence.
6. Reject if actual evidence is missing or unreadable.
7. Call WrongTargetValidator with non-optional expected values.
8. Call BindingValidator with complete binding data.
9. Compare every required expected field with actual evidence.
10. Any mismatch or missing value -> DENY.
11. Atomically claim the intent.
12. Only then allow the existing transport boundary to proceed.
```

No step may be skipped because a field is optional in the current `SendRequest` type.

---

## 5. Required Denial Reasons

```text
INTENT_NOT_FOUND
INTENT_HASH_INVALID
INTENT_EXPIRED
INTENT_STATE_INVALID
INTENT_ALREADY_CONSUMED
ADAPTER_EVIDENCE_UNAVAILABLE
EXPECTED_IDENTITY_MISSING
ACTUAL_IDENTITY_MISSING
IDENTITY_MISMATCH
PLAN_MISMATCH
POLICY_MISMATCH
CONFIRMATION_MISSING
CONFIRMATION_EXPIRED
CONFIRMATION_REPLAYED
SESSION_GENERATION_MISMATCH
DOCUMENT_GENERATION_MISMATCH
WRONG_TARGET_VALIDATION_FAILED
BINDING_VALIDATION_FAILED
```

---

## 6. Work Breakdown

### WU-01 — Send-Path and Adapter Audit

- Map current `performSend` call chain.
- Enumerate every current identity field and its producer.
- Identify which fields cannot currently be observed.
- Document required Adapter evidence gaps.

### WU-02 — AdapterEvidence Contract Plan

- Define evidence fields and provenance.
- Define missing/unreadable representation.
- Define observation timestamp and freshness semantics.
- Keep all platform-specific selectors behind the adapter boundary.

### WU-03 — Guard Interface Plan

- Define `PreSendGuard` input as `intent_id` plus non-identity execution metadata.
- Define output as typed allow/deny result.
- Define audit record fields.
- Define atomic claim semantics as a future dependency.

### WU-04 — Failure Matrix

- Missing expected.
- Missing actual.
- Empty values.
- Cross-shop/account/customer/conversation.
- Plan/policy mismatch.
- Confirmation missing/expired/replayed.
- Session/document generation mismatch.
- Adapter read failure.
- Intent hash/expiry/state failure.

### WU-05 — Test Matrix

- Positive normal path.
- Each denial reason.
- Validator bypass attempt.
- Caller attempts to inject expected fields.
- Duplicate guard invocation.
- Adapter evidence failure.
- Audit trace completeness.

### WU-06 — Integration Plan

- Identify exact insertion point before `SegmentedSender`.
- Define how to avoid double-validation.
- Define how current tests are migrated.
- Define rollout/feature-flag prerequisite.
- Do not implement in AU-04.

### WU-07 — Planning Report

- Produce `reports/AU-04-pre-send-guard-planning-report.json`.
- Record implementation not performed.
- Record decisions required.
- `next_stage_not_executed = true`.

---

## 7. Acceptance Criteria

| ID | 验收标准 |
|---|---|
| AC-01 | 每个 expected identity 字段都有 actual evidence source 计划。 |
| AC-02 | Guard 只接受 intent reference，不接受调用方自建 identity。 |
| AC-03 | WrongTargetValidator 和 BindingValidator 都是 mandatory gate。 |
| AC-04 | 缺 expected/actual 时明确 fail closed。 |
| AC-05 | session/document generation 的读取和比较方案明确。 |
| AC-06 | 所有 denial reason 有审计映射。 |
| AC-07 | 正负和绕过测试矩阵完整。 |
| AC-08 | send-path insertion point 明确但未实现。 |
| AC-09 | 未修改发送路径、Adapter、Transport、真实发送或 AUTO。 |
| AC-10 | 规划报告完成，后续实现需单独授权。 |

---

## 8. Current Status

```text
AU-04 Planning: CONTROLLER_PASS_CLOSED
AU-04 Implementation: NOT_AUTHORIZED
Send Path Integration: NOT_AUTHORIZED
Transport Integration: NOT_AUTHORIZED
Real Send: NOT_AUTHORIZED
AUTO: NOT_GRANTED
Production Enablement: NOT_AUTHORIZED
```
## 9. Planning Record — 2026-10-03

- WU-01 through WU-07 completed.
- Adapter evidence gaps identified.
- Guard algorithm and failure matrix documented.
- Integration point documented, not implemented.
- No send-path, Adapter, Transport, real-send, or AUTO changes made.
