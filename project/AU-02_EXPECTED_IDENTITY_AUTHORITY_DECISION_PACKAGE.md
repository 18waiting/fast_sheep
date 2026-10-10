# AU-02 — Expected Identity Authority Decision Package

> **状态:** APPROVED / CONTROLLER_PASS / CLOSED
> **日期:** 2026-10-03
> **前置:** AU-01 Controller `PASS / CLOSED`
> **唯一不变量:** 每次发送的 expected identity 只能有一条明确、不可循环、可追溯的权威来源。
> **实现状态:** NO CODE IMPLEMENTED
> **执行权限:** 真实发送、AUTO 和生产启用均未授权

---

## 1. Executive Decision

建议批准以下方向：

```text
EXPECTED_IDENTITY_AUTHORITY_V1

inbound IdentityLock
+ ReplyPlan
+ PolicyDecision
+ Human Confirmation
= immutable ExecutionIntent

ExecutionIntent.expected
    must be compared with
live AdapterEvidence.actual

missing / conflicting / stale / unreadable
= DENY
```

核心原则：

1. `ExecutionIntent` 是 expected identity 的唯一权威。
2. 发送调用方不能自行提供或覆盖 expected identity。
3. live Adapter evidence 只代表发送时事实，不能反过来定义 expected。
4. 缺少 expected 或 actual 时不得跳过校验。
5. `WrongTargetValidator` 和 `BindingValidator` 都必须成为强制门。
6. 该决定只定义语义，不实现代码。

Controller 可选择：

- `APPROVE`: 进入 AU-03 `ExecutionIntent` 合约实现。
- `APPROVE_WITH_CHANGES`: 修改字段、冻结点或失效规则后再进入 AU-03。
- `REJECT`: 保留现状并重新讨论。

---

# WU-01 — Current Call-Chain Audit

## 2. Current Send Flow

```text
onBuyerMessage(shopId, conversationId, BuyerMessage)
-> invalidate old suggestion
-> generation token
-> aiEngineClient.generateReply(...)
-> processAiResult(...)
-> SuggestionState(reply, generation, status)
-> sendSuggestion(state)
-> SendRequest(shopId, conversationId, reply, generation, mode)
-> performSend(request)
-> WrongTargetValidator
-> SegmentedSender
-> PlatformAdapter.sendText(shopId, conversationId, segments)
```

## 3. Confirmed Gaps

### GAP-01 — SendRequest is not an immutable identity contract

`packages/orchestrator/src/state/conversation-runtime-state.ts:18-25`

当前字段：

```text
shopId
conversationId
reply
generation
mode
[key: string]: unknown
```

没有强类型要求：

- merchant_id
- store_id
- platform
- platform_account_id
- customer_identity
- trigger_message_id
- plan_id
- plan_hash
- policy_version
- confirmation_hash
- session_generation
- document_version

### GAP-02 — Expected values are absent in the actual send path

`packages/orchestrator/src/core/conversation-orchestrator.ts:798-811`

当前 `WrongTargetValidator.validate(...)` 没有传入：

- expectedShopId
- expectedCustomerUid
- expectedDocumentVersion

因此跨目标比较会跳过，而不是失败关闭。

### GAP-03 — BindingValidator is implemented but not enforced

`packages/orchestrator/src/core/binding-validator.ts:53-94` 可以验证六类绑定，但 `performSend()` 当前没有调用它。

### GAP-04 — Caller can inject loosely typed identity fields

`SendRequest` 的 `[key: string]: unknown` 允许调用方通过宽松字段传入身份值，但没有权威 producer 约束。

### GAP-05 — Platform Adapter receives only shop/conversation

`packages/orchestrator/src/ports/platform-adapter.ts`

```text
sendText(shopId, conversationId, segments)
```

Adapter 当前没有收到一个完整的 identity-locked execution request，也没有返回可供 pre-send 复核的完整 identity evidence。

### GAP-06 — Suggestion carries no identity/plan binding

`SuggestionState` 当前主要保存 reply、generation 和状态，没有：

- ReplyPlan ID
- Plan hash
- Policy version
- Confirmation binding
- Expected session/document generation

### GAP-07 — Confirmation hash is incomplete and placeholder-grade

`packages/orchestrator/src/core/human-confirm-controller.ts:444-471`

当前 hash：

- 包含 confirmation ID、plan ID、confirmedAt、confirmedBy、IdentityLock 和 generation。
- 不包含 reply content/hash、policy version、session evidence、document generation。
- 实现是简单 32-bit 字符串 hash，并明确标注为 placeholder，不是生产级 SHA-256。

### GAP-08 — Human confirmation state is in-memory

`HumanConfirmController` 当前用 `Map` 保存 pending requests。进程重启后确认状态和消费记录无法自然恢复，不能形成持久的一次性授权证明。

---

# WU-02 — Authority Options

## 4. Option Comparison

| Option | Expected source | Decision |
|---|---|---|
| A | live Adapter observation | Reject: circular self-validation |
| B | inbound IdentityLock only | Insufficient: no plan/policy/confirmation freshness |
| C | IdentityLock + ReplyPlan + PolicyDecision + Confirmation -> ExecutionIntent | Recommended |
| D | C plus signed capability token | Future hardening after C is stable |

## 5. Recommended Option C

```text
Trusted input
-> IdentityLock
-> ReplyPlan
-> PolicyDecision
-> Human Confirmation
-> ExecutionIntent
-> Claim
-> PreSendGuard
-> AdapterEvidence comparison
-> Transport
-> Verification
-> Audit
```

`ExecutionIntent` 不是 UI 草稿，也不是发送参数；它是不可变、版本化、可审计的执行意图。

---

# WU-03 — Field Authority, Freeze Point, Invalidation

## 6. Field Authority Matrix

| Field | Expected authority | Freeze point | Actual evidence | Rule |
|---|---|---|---|---|
| merchant_id | inbound IdentityLock | turn creation | trusted runtime scope | mismatch -> DENY |
| store_id | inbound IdentityLock / store binding | turn creation | trusted adapter scope | mismatch -> DENY |
| platform | inbound IdentityLock | turn creation | adapter platform | mismatch -> DENY |
| platform_account_id | inbound IdentityLock / runtime binding | turn creation | current adapter account | mismatch -> DENY |
| customer_identity.kind/value | inbound customer identity | turn creation | selected customer evidence | mismatch -> DENY |
| conversation_id | resolved internal conversation | turn creation | selected conversation | mismatch -> DENY |
| trigger_message_id | aggregated inbound turn | turn creation | current trigger binding | mismatch -> DENY |
| ReplyPlan.plan_id | ReplyPlan | plan creation | plan reference | missing -> DENY |
| plan_hash | canonical ReplyPlan serialization | plan creation | recomputed plan hash | mismatch -> DENY |
| policy_version | PolicyDecision | policy decision | policy reference/version | mismatch -> DENY |
| confirmation_hash | confirmation ceremony | confirmation | consumed binding hash | missing/replayed -> DENY |
| session_generation | trusted runtime evidence | confirmation; AUTO at policy approval | live session evidence | changed -> DENY |
| document_generation | trusted document evidence | confirmation; AUTO at policy approval | live document evidence | changed -> DENY |
| expires_at | policy/confirmation | intent creation | current clock | expired -> DENY |
| nonce | intent creation | intent creation | consumed nonce store | replay -> DENY |

## 7. Invalidation Rules

ExecutionIntent must be invalidated when any of these changes:

- new inbound customer message in the same IdentityLock scope
- new ReplyPlan or plan hash
- policy version
- confirmation status or expiry
- confirmation already consumed
- selected shop
- platform account
- conversation/customer
- trigger message
- session generation
- document generation
- current runtime evidence becomes unreadable

Invalidation behavior:

```text
invalidated -> no send -> reason retained -> human action -> new intent required
```

---

# WU-04 — Fail-Closed Matrix

| Condition | Result | Required reason |
|---|---|---|
| expected field missing | DENY | `EXPECTED_IDENTITY_MISSING` |
| expected field empty | DENY | `EXPECTED_IDENTITY_EMPTY` |
| actual field missing | DENY | `ACTUAL_IDENTITY_MISSING` |
| actual source unreadable | DENY | `ACTUAL_EVIDENCE_UNAVAILABLE` |
| expected != actual | DENY | `IDENTITY_MISMATCH` |
| plan hash mismatch | DENY | `PLAN_STALE_OR_MODIFIED` |
| policy version mismatch | DENY | `POLICY_STALE_OR_MODIFIED` |
| confirmation expired | DENY | `CONFIRMATION_EXPIRED` |
| confirmation consumed | DENY | `CONFIRMATION_REPLAYED` |
| session generation changed | DENY | `SESSION_STALE` |
| document generation changed | DENY | `DOCUMENT_STALE` |
| nonce reused | DENY | `INTENT_REPLAYED` |
| normal expected == actual | ALLOW | `IDENTITY_VERIFIED` |

The decision package intentionally does not define a partial-pass mode. Any required uncertainty blocks execution.

---

# WU-05 — Test Matrix for AU-03/AU-04

## 8. Positive Tests

1. same shop and customer.
2. same buyer ID in different stores remains distinct.
3. valid confirmation consumed once.
4. valid session/document generation.
5. valid plan and policy hash.
6. normal send creates one audit chain.

## 9. Negative Tests

1. expected shop missing.
2. expected customer missing.
3. actual customer unreadable.
4. cross-shop target.
5. cross-account target.
6. cross-customer target.
7. cross-conversation target.
8. stale trigger message.
9. new inbound invalidates old plan.
10. plan hash mismatch.
11. policy version mismatch.
12. expired confirmation.
13. replayed confirmation.
14. changed session generation.
15. changed document generation.
16. adapter evidence read failure.
17. missing expected value was previously skipped.
18. two callers try to consume one intent.
19. process restart and confirmation recovery.
20. duplicate send request.

---

# WU-06 — Proposed Decision

## 10. Proposed Decision Text

```text
EXPECTED_IDENTITY_AUTHORITY_V1

ExecutionIntent is the sole expected-identity authority for an executable send.
It is derived from trusted bounded inputs: inbound IdentityLock, ReplyPlan,
PolicyDecision, and the required human confirmation when applicable.

The send path may not construct or override expected identity from an arbitrary
request. At execution time, deterministic code must read current AdapterEvidence
and compare every required expected field against it.

Missing, empty, conflicting, stale, unreadable, expired, replayed, or already
consumed identity evidence must fail closed. No validator may skip a required
comparison because an expected value is absent.

BindingValidator and WrongTargetValidator are mandatory gates. The session and
document generation are frozen at confirmation time for HUMAN_CONFIRM and at
policy authorization time for AUTO. Any later change invalidates the intent.

This decision defines semantics only. It does not authorize code, transport,
real send, AUTO, or production enablement.
```

## 11. Required Controller Decisions

| ID | Decision | Recommended |
|---|---|---|
| D1 | Accept Option C | YES |
| D2 | Make ExecutionIntent the sole expected authority | YES |
| D3 | Require live Adapter evidence as actual | YES |
| D4 | Freeze session/document at confirmation/policy approval | YES |
| D5 | Fail closed on missing expected/actual | YES |
| D6 | Require both validators in send path | YES |
| D7 | Define SHA-256/versioned confirmation hash | YES |
| D8 | Persist confirmation and nonce consumption | YES |
| D9 | Begin AU-03 only after approval | YES |

---

## 12. Residual Risks

```text
RISK-01: current SuggestionState has no IdentityLock/ReplyPlan binding.
RISK-02: current PlatformAdapter cannot return complete identity evidence.
RISK-03: HumanConfirmController is in-memory.
RISK-04: confirmation hash is incomplete and placeholder-grade.
RISK-05: current send path has no policy/plan binding.
RISK-06: existing send tests may pass without proving expected-identity completeness.
```

These risks are inputs to AU-03 and AU-04; they are not fixed in AU-02.

---

## 13. AU-02 Exit Candidate

AU-02 planning is complete when Controller selects:

- `APPROVE`
- `APPROVE_WITH_CHANGES`
- `REJECT`

No code implementation is part of AU-02.
