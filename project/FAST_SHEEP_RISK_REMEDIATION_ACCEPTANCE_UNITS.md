# Fast Sheep 风险修复计划

> **状态:** AU01_PASS_CLOSED / AU02_PASS_CLOSED / AU03_PASS_CLOSED / AU04_PLANNING_PASS_CLOSED / AU04I_PASS_CLOSED / AU04S_REPAIR_APPLIED_AWAITING_CONTROLLER_REVIEW / AU05_NOT_AUTHORIZED
> **授权轴（引用账本，未变更）:** TRANSPORT_NOT_AUTHORIZED / REAL_SEND_NOT_AUTHORIZED / AUTO_NOT_GRANTED / PRODUCTION_NOT_AUTHORIZED
> **计划基线:** `main` / `3caf5d8`（本计划撰写时的 HEAD）
> **最近更新提交:** `main` / `1310cbf`（AU-04S 集成与本文件入库）
> **创建日期:** 2026-10-02
> **控制器决定:** SHEEP-312 = PASS（用户在 2026-10-02 的当前会话中明确给出）
> **用途:** 将 R-01 至 R-08 及社区成熟模式拆成“一个单元只解决一个不变量”的候选验收单元。
> **权威来源:** `project/PROJECT_STATE.json` → `remediation_program`（`state_authority.subordinate_program_policy = NAVIGATION_ONLY`）。本文所有状态串均为投影，不构成授权；与账本冲突时以账本为准。
> **重要:** 本文是计划文档，不是 SHEEP-313 或任何后续单元的执行授权。所有真实发送、AUTO、生产启用和 live evidence 授权仍按 `PROJECT_STATE.json` 单独管理。

---

## 状态词读法（投影说明，非契约定义）

本节只解释本文档中的状态词应当如何阅读。值域契约由 `project/PROJECT_STATE.json` →
`state_authority` 与母提示词 DEC-021 / DEC-022 拥有；本节不定义新契约，不得被引用为
授权依据，也不构成第二个事实源。

三条轴必须分开读，任何一条都不能推断出另一条：

| 轴 | 权威字段 | 读法 |
|---|---|---|
| 审查轴 | 各验收报告的 `controller_review` | 值域为 `PASS` / `REPAIR`（DEC-022 锁定）。报告中的 `PENDING` 读作“值域内尚无决定”，不是第三个决定值 |
| 单元状态轴 | `remediation_program.current_unit_state` | 直接引用账本原值，例如 `REPAIR_APPLIED_AWAITING_CONTROLLER_REVIEW` |
| 授权轴 | `remediation_program.execution_lanes.*` | 直接引用账本原值，例如 `NOT_AUTHORIZED` / `NOT_GRANTED` |

阅读规则：

1. 单元状态为“待审”不等于任何授权被打开。
2. `controller_review = PASS` 只关闭审查门，不打开执行门。
3. `closed_date` 仅在 `controller_review = PASS` 后出现；待审单元不得预填，字段缺失即表示未关单。
4. 本文档与账本用词不一致时，以账本原值为准，并把差异按文档缺陷处理。
5. 将三条轴正式结构化、并让文档状态串自动对齐账本，属于 AU-08 范围，需单独授权。

---

## Controller Decision Record

| 字段 | 记录值 |
|---|---|
| Task | `SHEEP-312` |
| Codex result | `COMPLETE` |
| Controller decision | `PASS` |
| Decision date | `2026-10-02` |
| Decision source | 当前会话中的 Controller/Owner 指令 |
| Canonical state update | `COMPLETE_AU01` |
| Execution authorization impact | `NONE` |
| SHEEP-313 authorization | `STILL_NOT_AUTHORIZED` |
| AUTO authorization | `STILL_NOT_GRANTED` |
| Live evidence authorization | `STILL_PAUSED / NOT_AUTHORIZED` |

说明:

- PASS 已记录在本计划文档中。
- `project/PROJECT_STATE.json` 的 canonical 字段已由 AU-01 完成对账。
- PASS 只关闭 SHEEP-312 的审查门，不自动授权 SHEEP-313、真实发送、AUTO 或生产启用。


## AU-01 Execution Record

| 字段 | 结果 |
|---|---|
| AU-01 result | `COMPLETE` |
| Execution date | `2026-10-03` |
| Validator | `PROJECT_STATE_CONSISTENCY=PASS` |
| Consistency tests | `23/23 PASS` |
| current_phase | `MVP_E_MULTI_SHOP_EXPANSION` |
| current_milestone | `MVP-E MULTI_SHOP_EXPANSION` |
| current_milestone_state | `PLANNED / NOT_AUTHORIZED` |
| last_completed_milestone | `MVP-D AUTO` |
| last_closed_task | `SHEEP-312` |
| next task | `SHEEP-313` |
| next execution authorization | `false` |
| Controller review of AU-01 | `PASS / CLOSED` |
| AU-01 closed date | `2026-10-03` |
| SHEEP-313 started | `NO` |

验收报告: `reports/AU-01-canonical-state-reconciliation-report.json`

## AU-02 Execution Record

| 字段 | 结果 |
|---|---|
| AU-02 planning result | `COMPLETE` |
| Decision package | `READY_FOR_CONTROLLER_APPROVAL` |
| Recommended decision | `EXPECTED_IDENTITY_AUTHORITY_V1` |
| Implementation performed | `NO` |
| ExecutionIntent implemented | `NO` |
| PreSendGuard implemented | `NO` |
| Controller review of AU-02 | `PASS / CLOSED` |
| AU-02 closed date | `2026-10-03` |
| Next stage AU-03 | `SCOPED_CONTRACT_IMPLEMENTATION_COMPLETE` |

决策包: `project/AU-02_EXPECTED_IDENTITY_AUTHORITY_DECISION_PACKAGE.md`
验收报告: `reports/AU-02-expected-identity-authority-report.json`

## AU-03 Execution Record

| 字段 | 结果 |
|---|---|
| AU-03 result | `COMPLETE` |
| Scope | `ExecutionIntent contract only` |
| Domain typecheck | `PASS` |
| Domain tests | `106/106 PASS` |
| Contract tests | `19/19 PASS` |
| Registered contracts | `62` |
| Root typecheck | `PASS` |
| Send path modified | `NO` |
| Transport modified | `NO` |
| Controller review of AU-03 | `PASS / CLOSED` |
| AU-03 closed date | `2026-10-03` |

计划: `project/AU-03_EXECUTION_INTENT_CONTRACT_PLAN.md`
验收报告: `reports/AU-03-execution-intent-contract-report.json`

## AU-04 Planning Record

| 字段 | 结果 |
|---|---|
| AU-04 planning | `PASS / CLOSED (PLANNING_ONLY)` |
| AU-04 planning closed date | `2026-10-03`（该关单只覆盖 `PLANNING_ONLY` 范围） |
| 规划时点授权快照（2026-10-03） | implementation / send path integration = `NOT_AUTHORIZED`（历史证据，不回改） |
| 当前 implementation lane | `CONTRACT_AND_PURE_GUARD_PASS_CLOSED`（账本 `pre_send_guard_implementation`） |
| 当前 send path lane | `GUARD_INTEGRATION_REPAIR_APPLIED_AWAITING_CONTROLLER_REVIEW / TRANSPORT_NOT_AUTHORIZED`（账本 `send_path_integration`） |
| Transport integration | `NOT_AUTHORIZED` |
| Real send | `NOT_AUTHORIZED` |
| AUTO | `NOT_GRANTED` |
| Production enablement | `NOT_AUTHORIZED` |

计划: `project/AU-04_PRE_SEND_GUARD_PLAN.md`
实现附录: `project/AU-04_PRE_SEND_GUARD_IMPLEMENTATION_ADDENDUM.md`

## AU-04I Implementation Record

| 字段 | 结果 |
|---|---|
| AU-04I result | `COMPLETE` |
| Scope | `CONTRACT_AND_PURE_GUARD_ONLY` |
| Domain tests | `110/110 PASS` |
| PreSendGuard tests | `16/16 PASS` |
| Contract tests | `20/20 PASS` |
| Root typecheck | `PASS` |
| Send path modified | `NO` |
| Transport modified | `NO` |
| Controller review of AU-04I | `PASS / CLOSED` |
| AU-04I closed date | `2026-10-03` |
| Repair applied | `CONFIRMATION_FIELD_COMPARISON` |

实现报告: `reports/AU-04I-pre-send-guard-contract-report.json`

## AU-04S Implementation Record

| 字段 | 结果 |
|---|---|
| AU-04S result | `COMPLETE` |
| Scope | `SEND_PATH_INTEGRATION` |
| PreSendGuard integration tests | `24/24 PASS` |
| Root typecheck | `PASS` |
| Send path modified | `YES (guard gate only)` |
| Transport modified | `NO` |
| Real send / AUTO | `NOT_AUTHORIZED / NOT_GRANTED` |
| Controller review of AU-04S | `PENDING`（DEC-022 值域内尚无决定） |
| AU-04S unit state | `REPAIR_APPLIED_AWAITING_CONTROLLER_REVIEW`（引用账本 `current_unit_state`） |
| AU-04S closed date | 未填（未关单；见“状态词读法”第 3 条） |
| AU-04S repair applied | `PARTIAL_CONFIG_FAIL_CLOSED + CONFIG_LANE_GATE + FULL_AUDIT` |

实现报告: `reports/AU-04S-pre-send-guard-integration-report.json`
交接文档: `project/HANDOFF_AU04_TO_NEXT_2026-10-10.md`

---

## 0. Product Alignment Guard


```text
PRODUCT_ALIGNMENT: 修复身份绑定、授权边界、多租户隔离和状态治理
CURRENT_MVP_RELEVANCE: 直接支撑 AI-first 客服闭环中的可信身份、确定性执行和多店铺安全前提
CUSTOMER_VALUE: 防止错发、串店、知识泄漏和未经授权的自动执行
SAFETY_IMPACT: 降低错目标、重放、UNKNOWN 重试、跨租户泄漏和高风险状态漂移
OUT_OF_SCOPE: 不执行真实发送、不启用 AUTO、不启动 SHEEP-313、不修改生产边界
DECISION: PROCEED (PLANNING_ONLY)
```

---

## 1. 当前硬门

### GATE-0 — Controller 对 SHEEP-312 的决定

**必须先满足:**

- Controller 对 SHEEP-312 给出 `PASS` 或 `REPAIR`。
- Codex `COMPLETE` 不被当作 Controller `PASS`。
- `next_stage_not_executed = true` 保持不变。
- `current_execution_authorization`、`next_task_execution_authorized`、生产启用和 AUTO 权限在 GATE-0 后仍按账本另行授权。

### 规划原则

1. 一个候选验收单元只解决一个不变量。
2. 一个单元完成后不自动启动下一个单元。
3. 每个单元都必须有正常、负向、边界、恢复和审计证据。
4. 每个单元都要明确 allowed scope 和 must-not。
5. 每个单元都要声明它不会扩大实际执行授权。
6. 正式 SHEEP ID 由 Controller/Roadmap 决定，本草案中的 AU 编号仅用于规划。

---

## 2. 候选单元总览

```text
GATE-0 Controller 决定
    |
AU-01 状态单一事实源与投影一致
    |
AU-02 预期身份权威与生命周期决定
    |
AU-03 ExecutionIntent 不可变执行意图
    |
AU-04 PreSendGuard 失败关闭接入
    |
AU-05 人工确认一次性绑定与消费
    |
AU-06 SendAttempt、幂等与 UNKNOWN 恢复
    |
AU-07 Trusted Tenant Scope 与 RAG 隔离
    |
AU-08 授权状态分层与发布门禁
    |
SHEEP-313 多店铺对抗验证（另行授权）
```

说明:

- AU-01 是治理基础。
- AU-02 是 R-04 的语义前提。
- AU-03 至 AU-05 形成可信发送链。
- AU-06 处理 UNKNOWN、重复点击和崩溃恢复。
- AU-07 处理 R-05/R-06 的多租户隔离。
- AU-08 处理 COMPLETE/PASS/AUTHORIZED/PRODUCTION 的混淆。
- SHEEP-313 只在 Controller 明确推进后进行。

---

# AU-01 — 状态单一事实源与投影一致

**唯一不变量:**

> 只有 Controller 决定可以关闭任务；canonical lifecycle 字段与所有投影必须一致，任何授权门都不能被投影绕过。

**对应风险:** R-01、R-02、R-03、R-07、R-08。

**依赖:** GATE-0、Controller 明确授权的状态对账范围。

**允许范围:**

- `project/PROJECT_STATE.json` 的受控对账。
- `scripts/validate-project-state.mjs` 的契约校验。
- `tests/project-state-consistency.test.mjs` 的结构假设修复。
- 只读核对历史投影和阶段入口。

**禁止范围:**

- 不做业务代码重构。
- 不推进 `last_closed_task`，除非 Controller 已明确 PASS。
- 不启动 SHEEP-313。
- 不打开任何真实发送、AUTO 或生产授权。
- 不删除历史记录来掩盖漂移。

**必需产物:**

- Controller 对 SHEEP-312 的 PASS/REPAIR 记录。
- canonical 与 projection 的字段契约。
- `next_action` 的结构化或明确解析契约。
- 历史入口 authority 的显式处理规则。
- 修正后的 validator 和一致性测试。
- 对账报告，分别列出修复前和修复后状态。

**测试与验证:**

- `node scripts/validate-project-state.mjs` = 0 errors。
- `node --test tests/project-state-consistency.test.mjs` = 全部通过。
- 模拟“下一个任务被授权”时 validator 必须拒绝。
- 模拟 projection 修改但 canonical 不变时必须报错。
- 所有授权 gate 前后保持 false/paused，除非另有独立授权。

**退出标准:**

- canonical 与 projection 一致。
- 导航不再指向 SHEEP-305、SHEEP-308 等旧任务。
- `last_closed_task` 与 Controller 决定一致。
- 所有安全门保持原值。
- `next_stage_not_executed = true`。

**Must not conclude:**

- 本单元通过不代表 SHEEP-313 已授权。
- 本单元通过不代表 AUTO 已授权。

---

# AU-02 — 预期身份权威与生命周期决定

**唯一不变量:**

> 每次发送的 expected identity 只能有一条明确、不可循环、可追溯的权威来源。

**对应风险:** R-04 的语义前提。

**依赖:** AU-01。

**详细计划:** `project/AU-02_EXPECTED_IDENTITY_AUTHORITY_PLAN.md`。

**决策包:** `project/AU-02_EXPECTED_IDENTITY_AUTHORITY_DECISION_PACKAGE.md`。

**允许范围:**

- 身份来源比较。
- 生命周期和失效规则定义。
- 失败矩阵和数据流图。
- 新的架构决定记录。

**禁止范围:**

- 不修改发送路径。
- 不把当前请求中的字段拿来验证它自己。
- 不在决定未批准前实现 ExecutionIntent。
- 不将平台 Adapter 当前观测值当作原始终态意图。

**必须回答的问题:**

1. expected store 来自哪里。
2. expected customer 来自哪里。
3. expected platform account 来自哪里。
4. expected conversation 和 trigger message 来自哪里。
5. expected plan 和 policy version 来自哪里。
6. live Adapter evidence 在什么时候读取。
7. 新消息、刷新、切换店铺、重登录时哪些绑定失效。
8. 多个来源冲突时谁优先。
9. 缺字段、陈旧、冲突时如何 fail closed。
10. 人工确认的 hash 覆盖哪些内容。

**推荐原则:**

- expected identity 来自可信的入站 IdentityLock、已批准 ReplyPlan 和确认绑定。
- current evidence 来自发送时的 Adapter。
- 两者必须单向比较：intent expected vs adapter actual。
- 任何缺失或冲突都必须拒绝，不得跳过。

**必需产物:**

- 架构决定记录。
- 身份来源数据流图。
- 失效条件表。
- 正负测试矩阵。
- 明确的产品/安全决策项和未决项。

**退出标准:**

- Controller/Owner 明确批准身份权威。
- 所有过期和冲突规则无歧义。
- 未批准部分记录为 `PRODUCT_DECISION_REQUIRED`。
- 不写代码。

---

# AU-03 — ExecutionIntent 不可变执行意图

**唯一不变量:**

> 没有完整、不可变、可验证的 ExecutionIntent，就不存在可发送的执行意图。

**对应风险:** R-04 的合约基础。

**依赖:** AU-02。

**允许范围:**

- 领域类型。
- JSON Schema / contracts。
- hash、过期、nonce、状态。
- 合约测试。

**禁止范围:**

- 不接入真实 Transport。
- 不修改 HUMAN_CONFIRM 的最终发送路径。
- 不启用 AUTO。
- 不允许调用方任意覆盖身份字段。

**概念结构:**

```text
ExecutionIntent {
  intent_id
  merchant_id
  store_id
  platform
  platform_account_id
  customer_identity
  conversation_id
  trigger_message_id

  plan_id
  plan_hash
  policy_version
  confirmation_hash

  session_generation
  document_version

  created_at
  expires_at
  nonce
  state
}
```

**状态建议:**

```text
CREATED
CONFIRMED
CLAIMED
ATTEMPTED
ACKNOWLEDGED
REJECTED
UNKNOWN
EXPIRED
CANCELLED
```

**必需测试:**

- 缺少任一必需字段时验证失败。
- hash 修改后验证失败。
- 过期后验证失败。
- 同一 nonce 重放失败。
- 相同 customer UID 不同 store 不相等。
- `customerUid` 与 `conversationId` 互换失败。
- plan ID 相同但 plan hash 不同不相等。
- session/document generation 变化后 intent 失效。

**退出标准:**

- 合约完整。
- 全部合约测试通过。
- 真实发送路径没有行为变化。
- 审计设计不泄露不必要的客户内容。

---

# AU-04 — PreSendGuard 失败关闭接入

**唯一不变量:**

> 任一 required identity 缺失、冲突、陈旧或不可读时，发送必须被拒绝，且 BindingValidator 不能被绕过。

**对应风险:** R-04。

**依赖:** AU-02、AU-03。

**允许范围:**

- 发送路径接入。
- Adapter 当前证据读取。
- WrongTargetValidator 和 BindingValidator 的强制调用。
- 失败关闭、审计和负向测试。

**禁止范围:**

- 不启用真实生产发送。
- 不启用 AUTO。
- 不允许调用方通过 Partial request 注入新身份。
- 不允许缺少 expected 时跳过比较。
- 不用“已有一次发送成功”作为未来目标正确证据。

**目标流程:**

```text
send request
-> load ExecutionIntent
-> verify status/hash/expiry/single-use
-> call WrongTargetValidator
-> call BindingValidator
-> read current Adapter evidence
-> compare expected vs actual
-> any failure: deny
-> atomic claim
-> transport call
```

**必需负向测试:**

- 店铺 A intent 用于店铺 B。
- 客户 A intent 用于客户 B。
- 同 buyer 不同店铺。
- 平台账号不匹配。
- conversation 正确但 customer 错误。
- trigger message 过期。
- session 被替换。
- document generation 变化。
- expected 字段缺失。
- BindingValidator 未调用或被跳过。
- Adapter 无法提供证据。
- 跨商户/跨账号组合攻击。

**退出标准:**

- 正常路径通过。
- 所有恶意和缺字段路径 fail closed。
- 审计包含 intent、plan、policy、attempt、outcome。
- 真实执行权限没有扩大。

---

# AU-05 — 人工确认一次性绑定与消费

**唯一不变量:**

> 一次人工确认只能授权一个不可变 intent，并且只能成功使用一次，直到过期。

**对应风险:** R-04、human confirmation replay/stale binding。

**依赖:** AU-03、AU-04。

**允许范围:**

- confirmation token / nonce。
- hash 绑定。
- 单次消费。
- 过期和失效。
- 重放与替换测试。

**禁止范围:**

- 不让“确认按钮点击”成为泛化权限。
- 不让确认跨店铺、跨客户、跨 plan、跨 policy version 使用。
- 不让已消费确认再次授权。
- 不把人工确认当作 AUTO 授权。

**确认 hash 建议覆盖:**

```text
ReplyPlan
IdentityLock
policy_version
session_evidence
document_generation
```

**失效条件:**

- 新客户消息。
- 新 ReplyPlan。
- 店铺/会话切换。
- 页面刷新。
- Session 改变。
- 平台账号改变。
- policy version 改变。
- 确认过期。
- 确认已消费。
- 目标或 trigger 不匹配。

**必需测试:**

- 确认重放失败。
- 确认替换失败。
- 确认过期失败。
- plan hash 改变失败。
- session generation 改变失败。
- document generation 改变失败。
- 已消费确认二次调用失败。
- 正常单次发送成功。

**退出标准:**

- 确认只对单一 intent 有效。
- 消费行为原子化。
- 重放和 TOCTOU 场景全部拒绝。
- 审计可关联 confirmation 和 attempt。

---

# AU-06 — SendAttempt、幂等与 UNKNOWN 恢复

**唯一不变量:**

> 一旦可能产生平台副作用，UNKNOWN 不得自动重试；重复用户操作不得产生失控的第二次副作用。

**对应风险:** UNKNOWN 重试安全、重复点击、崩溃恢复。

**依赖:** AU-04、AU-05。

**允许范围:**

- SendAttempt 状态机。
- attempt id / idempotency key。
- claim/reserve。
- 崩溃恢复。
- 桌面通知和人工处置。
- 负向和故障注入测试。

**禁止范围:**

- 不假设 PDD 支持幂等。
- 不把本地幂等 key 当作平台幂等保证。
- 不对 ATTEMPTED/UNKNOWN 盲目重试。
- 不在本单元开启 AUTO。

**状态机:**

```text
CREATED
-> CLAIMED
-> ATTEMPTED
-> ACKNOWLEDGED
-> REJECTED
-> UNKNOWN
```

**规则:**

- CLAIMED 表示占位，不代表已发送。
- ATTEMPTED 表示可能已有外部副作用。
- ATTEMPTED 不得盲目重试。
- UNKNOWN 不得自动重试。
- UNKNOWN 必须保留原因、上下文、通知人工。
- safe pre-attempt 才可能在未来明确策略下重试。
- 崩溃后恢复必须区分 NOT_ATTEMPTED 和 ATTEMPTED/UNKNOWN。

**必需测试:**

- 网络超时只产生一次物理尝试。
- duplicate click 不产生两次副作用。
- process crash 后不误重试。
- UNKNOWN 产生通知且关闭自动链路。
- REJECTED 不自动重复发送。
- outcome 和 audit 一一对应。

**退出标准:**

- 重试规则被代码和测试共同证明。
- UNKNOWN 路径明确终止。
- 不影响真实生产授权。

---

# AU-07 — Trusted Tenant Scope 与 RAG 隔离

**唯一不变量:**

> 任何 RAG 写入、检索、缓存、重建和错误路径都不能跨 merchant/store scope。

**对应风险:** R-05、R-06、多店铺知识泄漏。

**依赖:** AU-01；若涉及发送知识，依赖 AU-04。

**允许范围:**

- Trusted TenantContext。
- 索引写入 scope。
- 检索 scope。
- namespace/filter/post-filter。
- 索引迁移和负向测试。

**禁止范围:**

- 不信任客户端传入的 tenant scope。
- 不把 `store_knowledge_type` 类型过滤当作 store_id 隔离。
- 不用“一个 SQL 测试通过”证明整个 RAG 隔离。
- 不开启多店铺 AUTO。

**方案优先级:**

1. 最强: 每店铺 namespace / partition / index。
2. 中等: 服务端强制 merchant/store filter + index metadata + post-filter + fail closed。
3. 最弱: 可选 metadata filter（不可接受作为唯一边界）。

**必需测试:**

- Store-A 查询不能命中 Store-B。
- 相同 product ID 在不同店铺返回各自知识。
- 相同 buyer 在不同店铺隔离。
- 缺 store scope 请求被拒绝。
- 缓存 key 包含 tenant scope。
- 索引重建后 scope 仍保留。
- 跨 merchant 查询被拒绝。
- 旧无 scope 索引 fail closed。

**退出标准:**

- 索引、检索、缓存、重建和错误路径全部通过。
- 跨店铺对抗测试通过。
- 多店铺隔离结论有证据。
- 不自动获得多店铺生产权限。

---

# AU-08 — 授权状态分层与发布门禁

**唯一不变量:**

> implementation completion、Controller review、execution authorization、production enablement 是四个独立状态，不能互相推断。

**对应风险:** COMPLETE/PASS/AUTHORIZED 混淆、交接文档越权推进。

**依赖:** AU-01。

**详细计划:** `project/AU-02_EXPECTED_IDENTITY_AUTHORITY_PLAN.md`。

**决策包:** `project/AU-02_EXPECTED_IDENTITY_AUTHORITY_DECISION_PACKAGE.md`。

**允许范围:**

- 结构化状态字段。
- validator 和 CI。
- 发布门禁。
- 审计记录。
- 文档和导航修正。

**禁止范围:**

- 不通过模板文字自动授权。
- 不在 CI 通过时自动设置 execution authorization。
- 不用交接文档替代 canonical state。
- 不删除历史状态。

**建议字段:**

```text
codex_result
controller_decision
execution_authorization
production_enablement
```

**门禁顺序:**

```text
implementation_complete
-> controller_review = PASS
-> execution_authorization = true
-> production_enablement = true（单独申请）
```

**必需验证:**

- 实现完成但 Controller 未 PASS 时拒绝推进。
- Controller PASS 但 execution authorization 未开会时拒绝执行。
- execution authorization 开了但 production enablement 未开时拒绝生产。
- 交接文档不能改变 canonical state。
- 修改授权字段必须留下审计。

**退出标准:**

四个状态可独立读取、独立测试、独立审计。
任何单次成功都不能自动打开下一道门。

---

# SHEEP-313 — 多店铺扩展验证

**唯一不变量:**

> 任何并发、会话、客户、知识、发送、审计、配置和故障路径都不能跨店铺或跨商户泄漏。

**状态:** `PLANNED / NOT_AUTHORIZED`

**依赖:**

- Controller 明确授权。
- 至少 AU-01 完成。
- R-05/R-06 的隔离方案已经明确。
- 不得把 AU 通过当作 SHEEP-313 授权。

**覆盖八项退出标准:**

1. 并发运行隔离。
2. 会话/客户隔离。
3. 知识/RAG 隔离。
4. 发送隔离。
5. 审计/交接隔离。
6. 故障/恢复隔离。
7. 配置隔离。
8. 跨商户/跨店铺对抗。

**必须遵守:**

- 合成数据。
- 不访问真实店铺数据。
- 不启用真实发送。
- 不启用 AUTO。
- 不修改现有架构，只验证和记录证据。
- 发现缺陷时记录，不顺手扩张 scope。

---

## 3. 推荐正式任务化顺序

| 顺序 | 候选单元 | 风险 | 是否涉及代码 | 前置条件 |
|---:|---|---|---|---|
| 0 | GATE-0 | 治理闭门 | 否 | Controller 决定 |
| 1 | AU-01 | R-01/02/03/07/08 | 文档/校验器 | GATE-0 |
| 2 | AU-02 | R-04 语义 | 否 | AU-01 |
| 3 | AU-03 | R-04 合约 | 是 | AU-02 |
| 4 | AU-04 | R-04 接入 | 是 | AU-03 |
| 5 | AU-05 | 重放/TOCTOU | 是 | AU-04 |
| 6 | AU-06 | UNKNOWN/重试 | 是 | AU-05 |
| 7 | AU-07 | R-05/R-06 | 是 | AU-01 |
| 8 | AU-08 | 权限混淆 | 文档/校验器/CI | AU-01 |
| 9 | SHEEP-313 | 多店铺证明 | 是 | Controller 明确授权 |

注意:

- 这不是一个自动执行的流水线。
- 每个单元结束后都要 Controller PASS/REPAIR。
- 每个单元都必须单独定义 SHEEP 任务和报告。
- 不得自动跨过 GATE-0。

---

## 4. 每个正式任务必须包含的最小结构

```text
Task:
Phase:
Milestone:
Acceptance Unit:
Sole Invariant:

Dependencies:
Allowed Scope:
Must Not:

Current Verified State:
Evidence Classification:
  CONFIRMED:
  INFERRED:
  PRODUCT_DECISION_REQUIRED:
  BLOCKED:
  DEFERRED:

Required Outputs:
Required Tests:
Required Negative Tests:
Required Recovery Tests:
Audit Evidence:

Exit Criteria:
Authorization Impact:
Next Stage Executed: NO
```

---

## 5. 最后的硬规则

- Codex `COMPLETE` 不关闭任务。
- Controller `PASS` 才关闭任务。
- 测试通过不等于执行获授权。
- 修复 R-04 不等于 AUTO 获授权。
- AU 通过不等于 SHEEP-313 获授权。
- 真实发送、平台操作和生产启用始终需要单独授权。
- 任何代码或状态变更都必须有对应单元的明确 Controller 授权；未获授权的单元保持不执行。

**当前状态:** AU01_PASS_CLOSED / AU02_PASS_CLOSED / AU03_PASS_CLOSED / AU04_PLANNING_PASS_CLOSED / AU04I_PASS_CLOSED / AU04S_REPAIR_APPLIED_AWAITING_CONTROLLER_REVIEW / AU05_NOT_AUTHORIZED

**授权轴（引用账本，未变更）:** TRANSPORT_NOT_AUTHORIZED / REAL_SEND_NOT_AUTHORIZED / AUTO_NOT_GRANTED / PRODUCTION_NOT_AUTHORIZED

**AU-02 决策包:** `project/AU-02_EXPECTED_IDENTITY_AUTHORITY_DECISION_PACKAGE.md`
