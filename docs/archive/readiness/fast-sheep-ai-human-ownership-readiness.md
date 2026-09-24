# AI / Human Ownership State Fact-Readiness（SHEEP-071 Read First）

> **时点导航（2026-09-24）**：本文是限定任务的 Read First / Fact-Readiness 历史审查；对应 Controller 评审已 `PASS`，但通过的是审查/决策包，不表示所述产品能力已实现、事实源已就绪或获得新执行授权。正文“待 Owner PASS”与 `NOT_READY / DEFER` 保留当时原意。 当前任务状态/授权以 [PROJECT_STATE.json](../../project/PROJECT_STATE.json) 为准；验收溯源见 [对应报告](../reports/SHEEP-071-report.json)。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.4 · 日期：2026-08-29
> 定位：SHEEP-071 本轮仅执行 **AI / Human Ownership State Fact-Readiness / Read First**（Owner 收紧：不授权 schema v11、不实现 ownership IPC/UI/service/state machine）。
> 结论：**NOT_READY / DEFER**——存在 8-state typed vocabulary（含 AI_ACTIVE）与 snapshot persistence shape，但无 production ownership producer、无 currentness semantics、无 trusted operator subject、无 state-holder relation evidence、无 IPC/UI；不为 Roadmap 造 AI/Human ownership 呈现。
> 边界：0 product code / 0 UI / 0 visual evidence；不改 schema v10；不进入 SHEEP-071 产品实现，不进入下一 SHEEP。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-158 | AI_HUMAN_OWNERSHIP_STATE_IS_A_FACT_DIMENSION_DISTINCT_FROM_AUTOMATION_LEVEL_AND_AI_SEND_AUTHORITY（不新增 human\|ai binary ownership mode 取代/平行 8-state vocabulary） |
| DP-159 | AI_ACTIVE_STATE_REQUIRES_EXPLICIT_PRODUCER_AND_CURRENTNESS_SEMANTICS（不得仅凭 row.state=AI_ACTIVE 声称 AI 当前正在负责） |
| DP-160 | HUMAN_OWNERSHIP_HOLDER_FACT_REQUIRES_VERIFIED_MEMBER_REFERENCE_SEMANTICS（stored owner Member ≠ current authenticated operator） |
| DP-161 | OWNERSHIP_WORKFLOW_STATE_AND_HOLDER_KIND_ARE_ORTHOGONAL_FACT_DIMENSIONS_UNTIL_RELATION_SEMANTICS_ARE_EVIDENCED |
| DP-162 | CURRENT_OWNERSHIP_PRESENTATION_REQUIRES_DEFINED_PRODUCER_AND_FRESHNESS_SEMANTICS（本轮不因此增加 timestamp schema） |
| I-77 | AI_ACTIVE_OR_HUMAN_STATE_NAME_DOES_NOT_IMPLY_AUTOMATION_POLICY_RESULT |
| I-78 | M5_ORCHESTRATOR_MODE_COUNTDOWN_TAKEOVER_STATUS_ARE_NOT_OWNERSHIP_FACTS_WITHOUT_PROJECTION_EVIDENCE（不建桥接 producer） |
| I-79 | ABSENT_OWNERSHIP_ROW_MUST_NOT_BE_PRESENTED_AS_AI_ACTIVE_OR_HUMAN_STATE |
| I-80 | AI_HUMAN_OWNERSHIP_READS_ARE_ANCHORED_TO_THE_AUTHORIZED_ACTIVE_CONVERSATION（stale-result guard） |
| I-81 | AI_ACTIVE_DOES_NOT_IMPLY_OWNER_KIND_AI_AND_OWNER_KIND_AI_DOES_NOT_IMPLY_AI_ACTIVE |
| I-82 | NON_AI_ACTIVE_STATE_MUST_NOT_BE_CLASSIFIED_AS_HUMAN_OWNERSHIP_WITHOUT_VERIFIED_HOLDER_FACTS |
| I-83 | OWNERSHIP_AI_ACTIVE_MUST_NOT_BE_PRESENTED_AS_REAL_TIME_AI_GENERATION_ACTIVITY_WITHOUT_RUNTIME_ACTIVITY_EVIDENCE |

## 2. Read First 证据（14 项 readiness）

### 2.1 AI_HUMAN_OWNERSHIP_STATE_FACT_READINESS = PARTIAL
- SHEEP-014 8-state typed vocabulary 含 AI_ACTIVE（vocabulary only，无 transition matrix）；`ownership_records.state` 为 TEXT 无 CHECK。
- 无 production fact path（无 producer/writer）。

### 2.2 OWNERSHIP_STATE_HOLDER_RELATION_READINESS = NOT_READY
- DP-161：workflow state 与 holder kind 是正交事实维度，relation 语义未经验证。
- I-81：AI_ACTIVE ⇎ owner_kind=ai；I-82：非 AI_ACTIVE 不得无 holder facts 分类为 human ownership。

### 2.3 AI_ACTIVE_SEMANTICS_READINESS = NOT_READY
- DP-159：AI_ACTIVE 需要 explicit producer + currentness semantics；`M1.5-R02` claim-by-ai → AI_ACTIVE 仅是 pure target-state mapping，非 producer。
- I-83：AI_ACTIVE 不得呈现为 real-time AI generation activity。

### 2.4 AI_OWNERSHIP_HOLDER_SEMANTICS_READINESS = NOT_READY
- `owner_kind=ai` 无 ai_agent/model identity、无 producer；不自行新增 ai_agent/model identity。

### 2.5 HUMAN_OWNERSHIP_HOLDER_SEMANTICS_READINESS = NOT_READY
- `owner_kind=member` + `owner_member_id` opaque；无 verified member reference semantics（DP-160）。
- Stored owner Member 与 current authenticated operator 是两个不同事实。

### 2.6 CURRENT_OPERATOR_SUBJECT_READINESS = NOT_READY
- 无 trusted human Member/operator subject runtime（SHEEP-066-PR2 `MANUAL_SEND_AUTHORIZATION_SUBJECT_READINESS=NOT_READY`）；Member 仅 domain type。
- 不推断 implicit local Owner；不造 synthetic Member（I-68）。

### 2.7 OWNERSHIP_AUTOMATION_LEVEL_SEPARATION_READINESS = PARTIAL
- Vocabulary/domain 已保持分离（I-77）；无 ownership→automation inference。
- 无 ownership→AI send authority surface；分离不变量在本轮未被破坏。

### 2.8 ORCHESTRATOR_PROJECTION_READINESS = NOT_READY
- M5 orchestrator `mode`（human_review/full_auto）、`countdown`、`takeover_status`（ManualTakeoverController/TakeoverBreakerPolicy）为 **runtime control facts**。
- 无 projection evidence 到 ownership facts；I-78：不建桥接 producer。

### 2.9 OWNERSHIP_SNAPSHOT_PRODUCER_READINESS = NOT_READY
- **无 production writer**：`SqliteOwnershipRepository`（INSERT OR REPLACE）存在且由 persistence index 导出，但 orchestrator/desktop Main 均不写入 ownership_records；唯一 writer 是 persistence 测试（test-only）。
- repository 存在 ≠ producer ready（约束 #11）。

### 2.10 OWNERSHIP_CURRENTNESS_SEMANTICS_READINESS = NOT_READY
- 无 freshness/currentness 字段或语义；restart/stale/absence 解释未定义；DP-162：本轮不加 timestamp schema。

### 2.11 OWNERSHIP_PERSISTENCE_READINESS = PARTIAL
- `ownership_records`（0006）snapshot 表 + `SqliteOwnershipRepository`（snapshot upsert）有测试；Main 未接线；I-69：snapshot ≠ audit。

### 2.12 AI_HUMAN_OWNERSHIP_IPC_READINESS = NOT_READY
- 无 ownership/AI-state typed IPC channel（desktop-ipc 42 canonical channels 无此类）；无 handler。

### 2.13 AI_HUMAN_OWNERSHIP_PRESENTATION_READINESS = NOT_READY
- 无 surface；I-79/I-80/I-82/I-83。
- 必须区分 Ownership snapshot label 与 live AI generation/activity indicator（renderer 仅有 M5 mode-toggle/countdown/worker-status runtime surfaces，无 ownership label）。

### 2.14 AI_HUMAN_OWNERSHIP_IMPLEMENTATION_READINESS = NOT_READY
- 上述任一缺失 → 产品实现不可行。

## 3. Decision Package（等待 Owner）
1. **不授权** `owner_ai_id`、timestamp/currentness fields、state/holder CHECK、transition/event/audit tables 或其它 v11 migration（schema v10 保持）。
2. **不实现** ownership IPC/UI/service/state machine；不接 Main；不建 M5→ownership 桥接 producer；不新增 ai_agent/model identity；不建立 Member/Auth/Capability/ResourceScope runtime。
3. **DEFER（推荐）**：事实 foundation 依赖 trusted operator subject + verified member reference semantics + production ownership producer + currentness semantics + state-holder relation evidence；届时按 DP-158~162 + I-77~I-83 提交最小 prerequisite。

## 4. 边界
- 未改 schema v10；未实现 Claim/Release（SHEEP-070 DEFER）、Handoff Reason/Queue、Supervisor Takeover（SHEEP-072/073）、Member/Auth/Session、Composer/Send/Attachments。
- 未改已 PASS：Composer/I-27~I-30、Delivery Attempt/I-33~I-41、Timeline/Queue、Customer/Product/Order Context、Ownership/Claim/Release（DP-152~157/I-68~I-76）。
- Renderer 不接触 SQLite；未联网；reference 树未读取。
