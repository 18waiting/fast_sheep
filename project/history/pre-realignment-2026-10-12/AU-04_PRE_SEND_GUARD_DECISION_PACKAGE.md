# AU-04 — PreSendGuard Planning Decision Package

> **状态:** PLANNING_PASS_CLOSED / IMPLEMENTATION_NOT_AUTHORIZED
> **日期:** 2026-10-03
> **实现附录:** `project/AU-04_PRE_SEND_GUARD_IMPLEMENTATION_ADDENDUM.md`
> **前置:** AU-03 `PASS / CLOSED`; ExecutionIntent contract implemented.
> **唯一不变量:** 任一 required identity 缺失、冲突、陈旧或不可读时，发送必须被拒绝，且 BindingValidator 不能被绕过。
> **实现状态:** NO CODE IMPLEMENTED
> **许可边界:** Planning only; send path、Transport、真实发送、AUTO、生产启用均未授权。

---

## 1. Executive Summary

AU-04 规划结论：

```text
ExecutionIntent (expected)
        must be compared with
AdapterIdentityEvidence (actual)

WrongTargetValidator + BindingValidator
        must both be mandatory

missing / stale / unreadable / conflicting
        = DENY
```

为实现这一点，后续实现前必须先补齐：

1. Adapter 的完整 identity evidence 读取能力。
2. `performSend()` 的 intent-based guard 入口。
3. session/document generation 的权威 producer。
4. guard deny/allow 的审计记录。

AU-04 本身不实现这些改动。

---

# WU-01 — Send-Path and Adapter Audit

## 2. Current Send Chain

```text
ConversationOrchestrator.onSendRequest / sendSuggestion
-> SendRequest(shopId, conversationId, reply, generation, mode)
-> ConversationOrchestrator.performSend
-> WrongTargetValidator.validate(...)
-> SegmentedSender.send(...)
-> PlatformAdapter.sendText(shopId, conversationId, segments)
-> PddPlatformAdapter.sendText
-> PddPageBridge.execute({ session_id, shop_id, conversation_id, text })
```

## 3. Confirmed Findings

### F-01 — Guard is not identity-complete

`performSend()` currently calls `WrongTargetValidator` with only:

- shopId
- conversationId
- optional fields extracted from the loosely typed request

It does not provide independent expected identity.

### F-02 — BindingValidator is not called

`BindingValidator` exists and validates six bindings, but the current send path does not invoke it.

### F-03 — Adapter sends without full identity evidence

`PddPlatformAdapter.sendText()` sends:

- session_id
- shop_id
- conversation_id
- text

It does not carry or verify:

- platform account identity
- customer identity independent of conversation
- trigger message binding
- document generation
- execution intent hash

### F-04 — Current conversation scan is insufficient

`PddPlatformAdapter.getCurrentConversationState()` currently returns only:

```json
{ "hasNewMessage": true | false }
```

That is not enough to validate expected identity.

### F-05 — PDD session state has partial evidence

`PddSessionState` can currently provide:

- shop_id
- session_id
- status
- active_conversation_id
- buyer_id
- selected customer observation
- selected customerUid, when SELECTED

It does not provide:

- canonical platform_account_id
- a document generation value
- trigger_message_id
- full adapter identity evidence as one atomic observation

### F-06 — PreSend revalidation is a separate mechanism

`PreSendController` can regenerate an AI suggestion when a new message is detected, but this is not a target-identity proof and cannot substitute for a PreSendGuard.

---

# WU-02 — AdapterIdentityEvidence Contract Plan

## 4. Proposed Evidence Shape

```text
AdapterIdentityEvidence
- evidence_id
- observed_at
- source
- shop_id
- store_id?
- platform
- platform_account_id?
- customer_identity?
- conversation_id?
- trigger_message_id?
- session_id
- session_generation?
- document_generation?
- availability:
    COMPLETE | PARTIAL | UNREADABLE
```

Rules:

1. `COMPLETE` evidence must include every field required by the guard.
2. `PARTIAL` evidence is not enough for an AUTO or HUMAN_CONFIRM send.
3. `UNREADABLE` is equivalent to missing evidence and must deny.
4. Platform-specific selectors, DOM reads and bridge commands remain inside the Adapter.
5. Evidence reads must be explicitly correlated to the current session and conversation.

## 5. Current Field Readiness

| Evidence field | Current availability | Plan |
|---|---|---|
| shop_id | Available from session/runtime | Map to guard |
| session_id | Available from PddSessionState | Map to guard |
| conversation_id | Available from runtime/session | Map to guard |
| buyer_id / customerUid | Partially available; selection may be unknown | Require explicit status and fail closed |
| platform_account_id | Not currently exposed as evidence | Add Adapter evidence producer plan |
| trigger_message_id | Not currently included in send guard path | Add binding source plan |
| document_generation | Not currently available | Define producer before implementation |
| session_generation | Not currently available | Define producer before implementation |
| plan/policy/confirmation | Available in ExecutionIntent contract, not wired | Require intent reference |

---

# WU-03 — Guard Interface and Algorithm Plan

## 6. Proposed Guard Input

```text
PreSendGuardRequest
- intent_id
- execution metadata that is not identity
```

The caller must not provide expected identity fields.

## 7. Proposed Guard Output

```text
PreSendGuardResult
- allowed: boolean
- reason_codes: string[]
- evidence_id?
- observed_at?
- intent_hash?
- audit_id
```

## 8. Deterministic Guard Order

```text
1. Load ExecutionIntent by intent_id.
2. Validate intent structure, expiry, hash, and lifecycle state.
3. Reject if intent is CLAIMED, ATTEMPTED, or terminal.
4. Read AdapterIdentityEvidence.
5. Validate actual evidence availability and required fields.
6. Invoke WrongTargetValidator using expected values from ExecutionIntent.
7. Invoke BindingValidator using complete expected and actual bindings.
8. Compare every expected field with actual evidence.
9. Any missing, stale, conflicting, unreadable, expired, or replayed condition -> DENY.
10. Produce an allow result and audit record.
11. Future AU-06: atomically claim intent before transport.
12. Only then may the existing transport boundary proceed.
```

Important: step 6 and step 7 must not be optional or skipped because a field is absent.

---

# WU-04 — Failure Matrix

| Condition | Policy | Reason |
|---|---|---|
| ExecutionIntent not found | DENY | `INTENT_NOT_FOUND` |
| intent hash invalid | DENY | `INTENT_HASH_INVALID` |
| intent expired | DENY | `INTENT_EXPIRED` |
| intent already claimed/attempted/terminal | DENY | `INTENT_STATE_INVALID` |
| expected identity missing | DENY | `EXPECTED_IDENTITY_MISSING` |
| actual evidence missing | DENY | `ACTUAL_IDENTITY_MISSING` |
| evidence is PARTIAL | DENY unless all required fields present | `ADAPTER_EVIDENCE_PARTIAL` |
| adapter read failed | DENY | `ADAPTER_EVIDENCE_UNAVAILABLE` |
| expected/actual shop mismatch | DENY | `IDENTITY_MISMATCH` |
| customer UID mismatch | DENY | `IDENTITY_MISMATCH` |
| conversation mismatch | DENY | `IDENTITY_MISMATCH` |
| platform account mismatch | DENY | `IDENTITY_MISMATCH` |
| trigger message mismatch | DENY | `IDENTITY_MISMATCH` |
| plan hash mismatch | DENY | `PLAN_MISMATCH` |
| policy version mismatch | DENY | `POLICY_MISMATCH` |
| confirmation missing/expired/replayed | DENY | matching confirmation reason |
| session generation mismatch | DENY | `SESSION_GENERATION_MISMATCH` |
| document generation mismatch | DENY | `DOCUMENT_GENERATION_MISMATCH` |
| WrongTargetValidator rejects | DENY | `WRONG_TARGET_VALIDATION_FAILED` |
| BindingValidator rejects | DENY | `BINDING_VALIDATION_FAILED` |
| all fields match and validators pass | ALLOW | `IDENTITY_VERIFIED` |

No partial allow is defined.

---

# WU-05 — Test Matrix

## 9. Positive Path

1. Valid intent and complete AdapterEvidence allow.
2. Same buyer ID in different stores remains distinct.
3. Valid plan/policy/confirmation passes.
4. Audit record contains one correlation chain.
5. Guard runs before `SegmentedSender.send`.

## 10. Negative Path

1. Missing expected field.
2. Missing actual evidence.
3. `UNREADABLE` evidence.
4. Cross-shop.
5. Cross-platform-account.
6. Cross-customer.
7. Cross-conversation.
8. Stale trigger message.
9. Expired intent.
10. Invalid intent hash.
11. Intent already claimed.
12. Confirmation replay.
13. Session generation changed.
14. Document generation changed.
15. Plan hash mismatch.
16. Policy version mismatch.
17. WrongTargetValidator bypass attempt.
18. BindingValidator bypass attempt.
19. Caller supplies expected identity fields directly.
20. Duplicate guard invocation.

## 11. Required Audit Fields

```text
intent_id
plan_id
plan_hash
policy_version
confirmation_id?
identity_lock
evidence_id
observed_at
guard_decision
reason_codes
session_id
conversation_id
```

Audit must not include credentials, tokens, cookies or unnecessary customer content.

---

# WU-06 — Integration Plan

## 12. Planned Insertion Point

The guard must be inserted inside `ConversationOrchestrator.performSend()` before:

- `SendStarted` emission
- `SegmentedSender.send()`
- any `PlatformAdapter.sendText()` call

Current sequence to replace later:

```text
WrongTargetValidator only
-> SendStarted
-> SegmentedSender.send
```

Planned sequence:

```text
PreSendGuard.evaluate(intent_id)
-> deny: SendFailed + audit + return
-> allow: future claim step
-> SendStarted
-> SegmentedSender.send
```

## 13. Migration Plan

- Add guard contract and tests first.
- Add Adapter evidence producer.
- Add guard unit tests with synthetic evidence.
- Add orchestrator integration tests.
- Keep existing validators callable, but make guard the single enforced entry point.
- No runtime integration in AU-04.

---

# 14. Required Decisions

| ID | Decision | Recommended |
|---|---|---|
| AD-01 | Approve AdapterIdentityEvidence contract | YES |
| AD-02 | Require COMPLETE evidence for send | YES |
| AD-03 | Make PreSendGuard the mandatory send gate | YES |
| AD-04 | Require both validators | YES |
| AD-05 | Define session_generation producer | Controller decision required |
| AD-06 | Define document_generation producer | Controller decision required |
| AD-07 | Define evidence freshness window | Controller decision required |
| AD-08 | Define atomic intent claim owner | Future AU-06 dependency |
| AD-09 | Do not modify send path in AU-04 | YES |

---

## 15. Residual Risks

```text
RISK-01: platform_account_id evidence is not currently exposed.
RISK-02: document_generation has no current producer.
RISK-03: session_generation has no current producer.
RISK-04: customer evidence may be UNKNOWN when selection is unresolved.
RISK-05: guard integration can be bypassed if transport remains callable elsewhere.
RISK-06: intent claim/consumption is not yet implemented.
RISK-07: platform-specific evidence reads must remain behind the Adapter boundary.
```

---

## 16. AU-04 Exit Candidacy

AU-04 planning is complete and ready for Controller review when:

- The evidence contract plan is accepted.
- The guard order is accepted.
- The failure matrix is accepted.
- The integration point is accepted.
- No code changes have been made.

Implementation remains blocked until explicitly authorized.
