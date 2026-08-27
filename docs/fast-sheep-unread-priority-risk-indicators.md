# Unread / Priority / Risk Indicator Fact-Readiness Review（SHEEP-062）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.1 · 日期：2026-08-28
> 定位：**Fact-Readiness Review / Decision Package**（本轮不实现任何 indicator）。
> 依据：DP-78~82 + I-10/I-11（Owner 收紧决策）、SHEEP-060 future notes #3/#4、Phase 4 硬约束。
> 方法：只读核验现有 Fast Sheep message/identity/ownership/audit/worker/platform contract；按 domain semantics 定性（同名字符串不视为目标事实）。

## 1. Read First 核验（现有事实契约）

| 契约 | 现有事实 | 对 indicator 的结论 |
|---|---|---|
| `normalized_messages` | id / conversation_id / external_ref；**无 created_at / sequence / role / content**；排序=technical id | 无消息排序/时间事实 → 无法建立 reader progress/watermark |
| `normalized_conversations` | id / merchant_id / store_id / platform_account_id / external_ref | 无 unread/priority/risk/activity 事实 |
| Member / Membership | 身份 + role 归属（无 read-progress/watermark） | 无 reader identity progress |
| OwnershipRecord | state / owner_kind(member\|ai) / owner_member_id（snapshot） | 处理/ownership 状态，**≠ read progress**（不得混为一个 unread） |
| Audit（M10 audit-service） | 领域审计条目 | 非会话 read-progress |
| Worker/Platform metadata | orchestrator 会话状态（in-memory）、platform session | 非 read-progress |
| 全仓扫描 | unread/priority/risk/read_at/watermark/severity 无目标事实（仅 backup 文案与注释） | 无现成 indicator 事实源 |

## 2. 逐项 Fact-Readiness 判定（独立结论）

### UNREAD_FACT_READINESS = `BLOCKED / DEFERRED`（prerequisite 未成熟）

- DP-78：unread 必须**从显式 reader-progress fact 派生**，不得持久化/伪造 `conversation.unread` boolean。
- 现有契约：消息无 created_at/sequence；无 reader identity progress（agent-local vs team/workflow processing state 未建模）。
- 结论：需先建 message ordering/timestamp 事实契约 + reader identity/watermark 契约 + agent-local vs team 状态分离 → **DEFER 到 M4.2 等真实 prerequisite 后**（或独立 prerequisite 单元）。

### PRIORITY_FACT_READINESS = `PRODUCT_DECISION_REQUIRED`（无事实源 + 语义未定义）

- DP-79：priority 需要显式 provenance & authority（source/authority/override/lifecycle）；不得硬编码 VIP/等待时长/资金规则；AI priority suggestion 不自动成为 authoritative priority。
- 现状：无 priority 事实；语义无治理依据。
- 结论：**产品/治理决策**——定义 priority 来源/权威/覆盖/生命周期后方可考虑实现。

### RISK_FACT_READINESS = `PRODUCT_DECISION_REQUIRED / DEFER`（无 typed risk signal 契约）

- DP-80：risk 必须是 **typed evidence-backed signal**（区分 risk type/source/evidence），不得造万能 low/medium/high risk badge；AI-derived risk 遵守 I-4（可核验依据、不暴露 hidden reasoning）。
- 现状：无 risk signal 契约。
- 结论：需治理/类型化 signal 契约 + evidence 来源；**DEFER**。

## 3. 决策包（DP-81/82 + I-10/I-11）

- **DP-81**：事实存储遵循语义而非 UI 便利——若未来需 unread 事实，先判断事实 owner/lifecycle（message 时间戳/reader watermark 的归属），再决定已有 projection / Worker-Domain contract / 新 persistence；**不假定 migration 0008**。
- **DP-82**：indicator 呈现需 authoritative fact + semantics + provenance/authority + safe projection 就绪才允许进入 Queue——当前**不满足 → 不呈现任何 indicator**。
- **I-10**：indicator 存在不自动获得 ranking 权限——当前 `conversation_id` technical ordering 保持，本单元**不改 Queue ordering**。
- **I-11**：UI indicator 必须可追溯到 authoritative fact/typed signal；**禁止 renderer heuristic**——本轮无 indicator，故无 heuristic 风险。

## 4. Prerequisites / Future Owner Decisions

- **Unread**：① message ordering/timestamp 事实契约（created_at/sequence）；② reader identity/read-progress watermark 契约；③ agent-local vs team/workflow processing state 分离 —— 建议 M4.2 或独立 prerequisite 单元。
- **Priority**：Owner 产品/治理决策（来源/权威/覆盖/lifecycle）；AI suggestion 非 authoritative。
- **Risk**：Owner 治理 + typed risk signal 契约（type/source/evidence）；AI-derived risk 按 I-4。
- 若需 schema/事实契约/producer 扩展：**本单元 STOP 后另提最小 prerequisite proposal**（不在此实施）。

## 5. 边界

- 未实现任何 indicator；未改 schema/migrations（v7 不变）；未改 Queue ordering；未造 Gallery/fake badge。
- 不要求 visual evidence；回归按纯审计任务执行。
- 未挂载 AI primitive；未实现 timeline/composer/平台 ingestion/sync/Outbox；未读 reference/nixiang；未联网。