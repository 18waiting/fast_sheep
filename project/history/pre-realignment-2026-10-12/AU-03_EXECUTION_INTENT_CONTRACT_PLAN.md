# AU-03 — ExecutionIntent Contract Plan

> **状态:** CONTROLLER_PASS / CLOSED
> **日期:** 2026-10-03
> **验收报告:** `reports/AU-03-execution-intent-contract-report.json`
> **前置:** AU-02 `PASS / CLOSED`；`EXPECTED_IDENTITY_AUTHORITY_V1` 已批准。
> **唯一不变量:** 没有完整、不可变、可验证的 `ExecutionIntent`，就不存在可发送的执行意图。
> **授权范围:** 仅实现纯合约层。
> **明确禁止:** 修改发送路径、接入 Transport、真实发送、AUTO、生产启用。

---

## 1. Goal

实现一个纯 `ExecutionIntent` 合约，使预期执行身份可以被：

- 结构化表达。
- 不可变绑定。
- JSON Schema 校验。
- SHA-256 哈希验证。
- 生命周期状态校验。
- 合约级负向测试。

本单元不执行发送，也不决定运行时如何取得 Adapter evidence。

---

## 2. Allowed Scope

- `packages/domain/src/execution-intent.ts`
- `packages/domain/src/index.ts` export
- `packages/domain/tests/execution-intent.test.mjs`
- `resources/contracts/schemas/domain/execution-intent.schema.json`
- `resources/contracts/schemas/registry.json`
- AU-03 计划、报告和状态账本

---

## 3. Prohibited Scope

- `packages/orchestrator/src/core/conversation-orchestrator.ts`
- `packages/orchestrator/src/state/conversation-runtime-state.ts`
- `packages/orchestrator/src/ports/platform-adapter.ts`
- `packages/platform-pdd/**`
- `packages/platform-web-common/**`
- 任何 Transport、发送、AUTO、真实平台或生产配置
- 任何把 `ExecutionIntent` 接入现有发送流程的改动

---

## 4. Required Contract

```text
ExecutionIntent
- schema_version
- intent_id
- authorization_source
- identity_lock
- plan_ref
- policy_ref
- confirmation_ref?
- session_generation
- document_generation
- created_at
- expires_at
- nonce
- state
- intent_hash
```

规则：

1. `intent_hash` 覆盖不可变字段。
2. `state` 是生命周期字段，不参与不可变 hash。
3. `HUMAN_CONFIRMATION` 必须带完整 confirmation reference。
4. `POLICY_AUTHORIZATION` 不得带 confirmation reference。
5. `identity_lock` 必须完整，不能使用 `UNKNOWN` 替代 required 字段。
6. `expires_at` 必须晚于 `created_at`。
7. hash 使用 SHA-256，并返回版本化 `sha256-<hex>`。
8. 状态迁移必须只允许合法转换。
9. 缺失、空值、过期或 hash 不符必须由 validator 拒绝。

---

## 5. Work Breakdown

### WU-01 — Contract Type

- 定义 `ExecutionIntent`。
- 定义 `ExecutionIntentState`。
- 定义 `ExecutionIntentAuthorizationSource`。
- 定义创建输入、验证结果和失败类型。

### WU-02 — Hash and Immutability

- 定义 canonical hash payload。
- 使用 Web Crypto SHA-256。
- 返回 `sha256-<hex>`。
- 验证 hash 时排除 `state`。

### WU-03 — Validation

- 验证必需字符串。
- 验证 IdentityLock 完整性。
- 验证 plan/policy reference。
- 验证 confirmation source 规则。
- 验证时间范围和 nonce。
- 验证状态。

### WU-04 — State Transitions

允许的概念迁移：

```text
CREATED -> PLAN_BOUND | CANCELLED | EXPIRED
PLAN_BOUND -> CONFIRMED | CANCELLED | EXPIRED
CONFIRMED -> CLAIMED | CANCELLED | EXPIRED
CLAIMED -> ATTEMPTED | CANCELLED
ATTEMPTED -> ACKNOWLEDGED | REJECTED | UNKNOWN
```

终态：

```text
ACKNOWLEDGED
REJECTED
UNKNOWN
EXPIRED
CANCELLED
```

### WU-05 — JSON Schema

- 新增 `execution-intent.schema.json`。
- 注册到 contracts registry。
- 保持与 TypeScript 合约字段一致。

### WU-06 — Contract Tests

覆盖：

- 正常创建。
- hash 一致性。
- state 改变不影响 immutable hash。
- 字段缺失/为空。
- IdentityLock 不完整。
- HUMAN_CONFIRMATION 缺 confirmation。
- POLICY_AUTHORIZATION 带 confirmation。
- 过期时间错误。
- nonce 为空。
- hash 篡改。
- 合法和非法状态迁移。

### WU-07 — Report

- `reports/AU-03-execution-intent-contract-report.json`
- 记录类型检查、测试、schema 验证。
- 记录未接入发送路径。
- `next_stage_not_executed = true`。

---

## 6. Acceptance Criteria

| ID | 验收标准 |
|---|---|
| AC-01 | ExecutionIntent 类型存在并导出。 |
| AC-02 | JSON Schema 存在并注册。 |
| AC-03 | SHA-256 hash 可创建并验证。 |
| AC-04 | state 不影响不可变 hash。 |
| AC-05 | HUMAN_CONFIRMATION/POLICY_AUTHORIZATION 规则可验证。 |
| AC-06 | 合法与非法状态迁移有测试。 |
| AC-07 | 合约测试全部通过。 |
| AC-08 | domain typecheck 通过。 |
| AC-09 | 未修改发送路径、Adapter 或 Transport。 |
| AC-10 | 真实发送、AUTO、生产启用保持关闭。 |

---

## 7. Current Status

```text
AU-03 Plan: COMPLETE
AU-03 Implementation: CONTROLLER_PASS_CLOSED
Send Path Integration: NOT_AUTHORIZED
Transport Integration: NOT_AUTHORIZED
Real Send: NOT_AUTHORIZED
AUTO: NOT_GRANTED
Production Enablement: NOT_AUTHORIZED
```
## 8. Execution Record — 2026-10-03

- `packages/domain/src/execution-intent.ts` implemented.
- `packages/domain/src/index.ts` exports the contract.
- JSON Schema added and registered in both package and resource registries.
- SHA-256 hashing, validation, and lifecycle transitions implemented.
- Domain tests: 106/106 PASS.
- Contract tests: 19/19 PASS.
- Registered contracts validated: 62.
- Root typecheck: PASS.
- Send path, Adapter, and Transport: NOT MODIFIED.
