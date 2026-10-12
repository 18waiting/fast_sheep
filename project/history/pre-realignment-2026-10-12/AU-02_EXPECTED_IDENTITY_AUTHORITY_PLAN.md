# AU-02 — Expected Identity Authority and Lifecycle Plan

> **状态:** CONTROLLER_PASS / CLOSED
> **计划日期:** 2026-10-03
> **前置条件:** AU-01 已获得 Controller `PASS` 并关闭。
> **唯一不变量:** 每次发送的 expected identity 只能有一条明确、不可循环、可追溯的权威来源。
> **对应风险:** R-04 的语义前提。
> **决策包:** `project/AU-02_EXPECTED_IDENTITY_AUTHORITY_DECISION_PACKAGE.md`
> **验收报告:** `reports/AU-02-expected-identity-authority-report.json`
> **禁止:** 本单元不修改发送路径，不实现 `ExecutionIntent`，不启用 AUTO，不进行真实发送。

---

## 1. Goal

确定以下问题的唯一答案：

> 发送前用于判断“正确目标”的 expected identity，权威来源是什么，何时冻结，何时失效？

AU-02 不解决“怎么发送”，而解决“以什么事实作为正确目标的证明”。

完成后必须交付：

- 身份来源权威链。
- expected identity 与 live Adapter evidence 的边界。
- 字段来源矩阵。
- 失效规则表。
- 冲突与缺失的 fail-closed 规则。
- 正负测试矩阵。
- Controller/Owner 可批准或拒绝的决策包。

---

## 2. Current Evidence

```text
CONFIRMED:
- SendRequest 目前只强类型约束 shopId、conversationId、reply、generation、mode，其他身份字段通过宽松索引传入。
- WrongTargetValidator 在 expected 字段缺失时会跳过比较。
- BindingValidator 已实现，但当前发送路径没有调用。
- HumanConfirmController 的 IdentityLock 包含 merchant、store、platform、platform account、customer、conversation、trigger message 和 generation。
- ConversationOrchestrator 当前从运行时状态构造发送请求，没有独立的不可变 expected identity。
- 当前真实发送、AUTO 和生产启用均未授权。

INFERRED:
- 如果把 live Adapter 当前观测值同时当作 expected 和 actual，会形成循环验证。
- 仅依赖入站 IdentityLock 可以证明来源，但不能单独证明某个 ReplyPlan 或确认仍然有效。
- 人工确认、策略版本和页面代次必须进入失效条件，否则存在 TOCTOU 与重放风险。

PRODUCT_DECISION_REQUIRED:
- expected identity 的组合来源。
- 期望 session/document generation 的冻结时点。
- 人工确认 hash 的最终覆盖范围。
- 新消息、刷新、重登录和切换会话的失效优先级。

BLOCKED:
- 无外部依赖阻止 AU-02 规划。
- AU-02 的实施会依赖 Controller/Owner 对推荐方案的批准。

DEFERRED:
- ExecutionIntent 合约实现。
- PreSendGuard 接入。
- 一次性确认消费。
- 真实发送与 AUTO。
```

---

## 3. Decision Question

当前存在四类候选权威来源。

| 方案 | expected 来源 | 优点 | 风险 | 结论 |
|---|---|---|---|---|
| A | 发送时 Adapter 的当前观测值 | 容易取得 | 用自己的观测验证自己，无法证明原始意图 | 拒绝 |
| B | 原始 inbound IdentityLock | 来源清晰、不可由发送请求改写 | 可能被新消息、新 plan、页面刷新或会话切换变得陈旧 | 不足 |
| C | inbound IdentityLock + ReplyPlan + policy + confirmation 形成的不可变 ExecutionIntent | 来源可追溯、绑定具体计划与确认、可与 live evidence 单向比较 | 必须明确冻结与失效规则 | 推荐 |
| D | C 再增加签名 capability token | 防篡改和重放能力强 | 初期实现成本较高，密钥生命周期复杂 | 后续增强 |

---

## 4. Recommended Authority Model

```text
Inbound IdentityLock
-> aggregated turn
-> ReplyPlan
-> PolicyDecision
-> Human Confirmation
-> ExecutionIntent (expected authority)
-> PreSendGuard
-> live Adapter evidence (actual)
-> Send / Verify / Audit
```

规则：

1. expected identity 只能来自可信业务链路。
2. live Adapter evidence 只代表发送时的当前事实，不能定义 original intent。
3. PreSendGuard 只能执行 `ExecutionIntent.expected == AdapterEvidence.actual`。
4. 缺少 expected、缺少 actual、冲突或陈旧时一律 `DENY`。
5. 发送调用方不能覆盖 expected identity。
6. expected identity 不允许由同一个待验证请求自证。
7. Adapter evidence 读取失败等同于不能证明目标正确。
8. 任何新的客户消息、plan、policy、session 或 document generation 都可能使 intent 失效。

---

## 5. Field Authority Matrix

| Field | Expected source | Actual source at send | Conflict action |
|---|---|---|---|
| merchant_id | inbound IdentityLock / store binding | trusted runtime scope | DENY |
| store_id | inbound IdentityLock / store binding | trusted adapter scope | DENY |
| platform | inbound IdentityLock | adapter platform | DENY |
| platform_account_id | runtime binding frozen at turn | current adapter account | DENY |
| customer_identity | inbound customer identity | selected conversation/customer evidence | DENY |
| conversation_id | internal conversation resolution | current selected conversation | DENY |
| trigger_message_id | aggregated inbound turn | current trigger binding | DENY |
| plan_id / plan_hash | ReplyPlan | execution request plan reference | DENY |
| policy_version | PolicyDecision | current policy decision reference | DENY |
| session generation | frozen at plan/confirmation boundary | live session evidence | DENY if changed |
| document generation | frozen at plan/confirmation boundary | live document evidence | DENY if changed |
| confirmation binding | confirmation hash / nonce | consumed confirmation record | DENY if missing, expired, replayed |

---

## 6. Lifecycle and Invalidation Plan

概念状态：

```text
CREATED
-> PLAN_BOUND
-> CONFIRMED
-> CLAIMED
-> ATTEMPTED
-> ACKNOWLEDGED
-> REJECTED
-> UNKNOWN
-> EXPIRED
-> CANCELLED
```

必须定义失效条件：

- 新 inbound 客户消息进入同一 IdentityLock。
- 新 ReplyPlan 生成。
- policy version 改变。
- 人工确认过期。
- confirmation 已消费。
- 切换店铺。
- 切换平台账号。
- 切换会话或选错客户。
- 页面刷新导致 document generation 改变。
- session 重新建立或登录状态变化。
- trigger message 不再是最新触发绑定。
- expected identity 任一字段缺失或冲突。

失效后的要求：

- 不得发送。
- 不得自动重试。
- 保留原因与审计关联。
- 交给人工作出新的确认。

---

## 7. Work Breakdown

### WU-01 — 调用链静态审计

- 入站到 SendRequest 的字段流图。
- 每个字段的 producer、transformer、consumer。
- 每个缺失字段的当前行为。
- 哪些字段来自调用方，哪些来自运行时状态。

### WU-02 — 身份权威选择

- A/B/C/D 方案比较。
- 推荐 C。
- Controller/Owner 决策记录模板。
- 明确哪些场景必须 `PRODUCT_DECISION_REQUIRED`。

### WU-03 — 冻结与失效规则

- expected identity 冻结时点。
- session/document generation 的适用范围。
- 新消息、刷新、重登录、切换店铺的失效矩阵。
- 多来源冲突优先级。

### WU-04 — Fail-Closed 矩阵

- 字段缺失、为空、冲突、过期。
- Adapter 读取失败。
- confirmation 重放。
- plan/policy 变化。
- 每个场景的预期结果和错误分类。

### WU-05 — 正负测试矩阵

- 正常发送路径。
- 跨店铺、跨账号、跨客户、跨会话。
- 旧 plan、旧 policy、旧 confirmation。
- 页面刷新、session 改变、document 改变。
- 缺少 expected 字段。
- Adapter evidence 不可读。
- 重复和重放。

### WU-06 — 决策包

- 推荐的 expected identity 来源。
- 推荐的生命周期。
- 推荐 hash 覆盖字段。
- 未决项与回滚方案。
- Controller/Owner 批准/拒绝入口。

### WU-07 — 验收报告

- `reports/AU-02-expected-identity-authority-report.json`
- 静态审计证据。
- 决策记录。
- `Implementation Performed: NO`
- `Next Stage Executed: NO`

---

## 8. Acceptance Criteria

| ID | 验收标准 |
|---|---|
| AC-01 | expected identity 只能有一个权威来源。 |
| AC-02 | 不存在 expected 与 actual 自证循环。 |
| AC-03 | 每个字段都有 expected source、actual source 和 producer。 |
| AC-04 | 所有失效条件明确且可测试。 |
| AC-05 | 缺失、冲突、陈旧和读取失败均 fail closed。 |
| AC-06 | 人工确认 hash 覆盖范围明确。 |
| AC-07 | 正负测试矩阵可供后续 AU-03/AU-04 直接使用。 |
| AC-08 | 未决产品/安全项被明确标记，不猜测。 |
| AC-09 | Controller/Owner 能明确批准或拒绝推荐方案。 |
| AC-10 | AU-02 不修改代码，不开启真实发送、AUTO 或生产授权。 |

---

## 9. Current Status

```text
AU-02 RESULT: COMPLETE
AU-01 Prerequisite: PASS / CLOSED
Expected Identity Decision: APPROVED
Code Changes: NONE
ExecutionIntent Implementation: NOT_AUTHORIZED
PreSendGuard Implementation: NOT_AUTHORIZED
Real Send: NOT_AUTHORIZED
AUTO: NOT_GRANTED
SHEEP-313 Started: NO
Next Stage Executed: NO
```

下一步是完成 WU-01 至 WU-06 的决策分析，然后由 Controller/Owner 对推荐方案给出批准或修改意见。AU-02 结束前不进入 AU-03 的实现。
