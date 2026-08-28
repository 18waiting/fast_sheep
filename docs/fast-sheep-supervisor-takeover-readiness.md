# Supervisor Takeover Fact-Readiness（SHEEP-073 Read First）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.4 · 日期：2026-08-29
> 定位：SHEEP-073 本轮仅执行 **Supervisor Takeover Fact-Readiness / Read First**（Owner 收紧：不授权 schema v11、不实现 Supervisor Takeover IPC/UI/service/state machine）。
> 结论：**NOT_READY / DEFER**——存在 8-state vocabulary 含 SUPERVISOR_TAKEOVER 与 M1.5-R02 action→target mapping（evidence only），但无 verified takeover occurrence producer、无 action authority、无 trusted operator subject、无 transition precondition/concurrency、无 ownership currentness；不为 Roadmap 造 Supervisor Takeover。
> 边界：0 product code / 0 UI / 0 visual evidence；不改 schema v10；不进入 SHEEP-073 产品实现，不进入下一 SHEEP。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-169 | SUPERVISOR_TAKEOVER_FACTS_REQUIRE_VERIFIED_PRODUCER_AND_AUTHORITY_SOURCE_NOT_ROLE_VOCABULARY |
| DP-170 | SUPERVISOR_TAKEOVER_IS_DISTINCT_FROM_M5_AI_SEND_INTERRUPTION_TAKEOVER（不建 M5 ManualTakeover → ownership takeover bridge） |
| DP-171 | SUPERVISOR_TAKEOVER_REQUIRES_AN_AUTHORIZED_CONVERSATION_AND_VERIFIED_CURRENT_OWNERSHIP_PRECONDITIONS |
| DP-172 | SUPERVISOR_TAKEOVER_ACTION_OCCURRENCE_AND_SUPERVISOR_TAKEOVER_OWNERSHIP_STATE_ARE_DISTINCT_FACTS |
| I-97 | ROLE_SUPERVISOR_DOES_NOT_IMPLY_TAKEOVER_AUTHORITY |
| I-98 | SUPERVISOR_TAKEOVER_REQUIRES_TRUSTED_OPERATOR_SUBJECT_FAIL_CLOSED（不推断 local Owner/Supervisor、不造 synthetic Member） |
| I-99 | SUPERVISOR_TAKEOVER_READS_ARE_ANCHORED_TO_THE_AUTHORIZED_ACTIVE_CONVERSATION（stale-result discipline） |
| I-100 | SUPERVISOR_TAKEOVER_ABSENCE_IS_THREE_WAY（无 verified occurrence / occurrence 已知但 detail 缺失 / current ownership takeover state）；不得统一呈现为"无接管/未知" |
| I-101 | UNREADY_HANDOFF_FACTS_MAY_NOT_BE_ASSUMED_AS_TAKEOVER_PRECONDITIONS_AND_UNREADY_OWNERSHIP_FACTS_MAY_NOT_BE_BYPASSED（Takeover 不要求 Handoff Queue/occurrence 必然先成立，但 Ownership current/transition facts 不可绕过） |
| I-102 | SUPERVISOR_TAKEOVER_ACTION_NAME_DOES_NOT_IMPLY_ROLE_SUPERVISOR_IS_THE_ONLY_AUTHORIZED_ACTOR（authority 服从 Capability + ResourceScope，非 role-name if logic） |
| I-103 | SUPERVISOR_TAKEOVER_MUTATION_REQUIRES_AN_ATOMIC_EXPECTED_CURRENT_OWNERSHIP_PRECONDITION（继承 I-74/I-76；本轮不新增 version/CAS schema） |

## 2. Read First 证据（16 项 readiness）

### 2.1 SUPERVISOR_TAKEOVER_STATE_FACT_READINESS = PARTIAL
- `SUPERVISOR_TAKEOVER` 在 8-state typed vocabulary 中（SHEEP-014）；`ownership_records.state` 为 TEXT 可容纳。
- 无 producer/currentness（约束 #16：vocabulary value 不得单独作为"主管已接管" presentation evidence；受 SHEEP-071 producer/currentness/state-holder semantics 约束）。

### 2.2 SUPERVISOR_TAKEOVER_ACTION_SEMANTICS_READINESS = PARTIAL
- M1.5-R02 `supervisor_takeover → SUPERVISOR_TAKEOVER + ownerRef=actor` 仅作为 **mapping evidence**（约束 #6）；不证明完整 source-state、authority、holder mutation 或 producer contract ready。

### 2.3 SUPERVISOR_TAKEOVER_ACTION_OCCURRENCE_READINESS = NOT_READY
- 无 takeover occurrence entity/event；DP-172：action occurrence ≠ ownership state。

### 2.4 SUPERVISOR_TAKEOVER_TRANSITION_PRECONDITION_READINESS = NOT_READY
- 无 source-state preconditions；DP-171 要求 verified current ownership preconditions（未 ready）。

### 2.5 SUPERVISOR_TAKEOVER_RESULTING_HOLDER_SEMANTICS_READINESS = NOT_READY
- ownerRef=actor mapping 证据强度低（约束 #7）；无 verified holder semantics（DP-160 类比）。

### 2.6 SUPERVISOR_TAKEOVER_ACTION_AUTHORITY_READINESS = NOT_READY
- action authority 非 role enum（I-102）；Capability + ResourceScope（SHEEP-012）未实现；DP-169。

### 2.7 SUPERVISOR_OPERATOR_SUBJECT_READINESS = NOT_READY
- 无 trusted human Member/operator subject runtime（SHEEP-066-PR2）；I-98 fail-closed。

### 2.8 SUPERVISOR_TAKEOVER_CONCURRENCY_CONTROL_READINESS = NOT_READY
- 无 atomic precondition/CAS；snapshot upsert 为 last-write-wins（I-74/I-76）；I-103；本轮不新增 version/CAS schema。

### 2.9 SUPERVISOR_TAKEOVER_OWNERSHIP_LINK_READINESS = NOT_READY
- 无 ownership producer/currentness/mutation（SHEEP-070/071 DEFER）；I-101 ownership facts 不可绕过；takeover state ⇎ known occurrence/reason（I-94 类比）。

### 2.10 M5_TAKEOVER_PROJECTION_SEPARATION_READINESS = READY / CONTRACT_CONFIRMED（候选）
- 证据支持 domain separation：M5 `ManualTakeoverController`/`TakeoverBreakerPolicy`/`onHumanTakeover` 为 AI 发送中断 runtime，非 ownership takeover，不持久化（约束 #17：不因 READY 建立 projection）。

### 2.11 SUPERVISOR_TAKEOVER_PRODUCER_READINESS = NOT_READY
- 无 production writer 写 SUPERVISOR_TAKEOVER ownership state；无 takeover occurrence producer（SHEEP-070/071 已确认 ownership_records 无 production writer）。

### 2.12 SUPERVISOR_TAKEOVER_CURRENTNESS_READINESS = NOT_READY
- 无 currentness/freshness semantics（DP-162/I-84 类比）。

### 2.13 SUPERVISOR_TAKEOVER_PERSISTENCE_READINESS = PARTIAL
- snapshot shape 能容纳 SUPERVISOR_TAKEOVER（state TEXT），但 ≠ takeover occurrence/history persistence（约束 #18）；无 event/audit table。

### 2.14 SUPERVISOR_TAKEOVER_IPC_READINESS = NOT_READY
- 无 takeover typed IPC（desktop-ipc 42 canonical channels 无此类）；无 handler。

### 2.15 SUPERVISOR_TAKEOVER_PRESENTATION_READINESS = NOT_READY
- 无 surface；I-99 锚定 authorized Active Conversation；I-100 三态区分。

### 2.16 SUPERVISOR_TAKEOVER_IMPLEMENTATION_READINESS = NOT_READY
- 上述任一缺失 → 产品实现不可行。

## 3. Decision Package（等待 Owner）
1. **不授权** `taken_over_by/taken_over_at/previous_owner/takeover_reason`、event/audit table、ownership version/CAS 或任何 v11 migration（schema v10 保持）。
2. **不实现** Supervisor Takeover IPC/UI/service/state machine；不建 M5→ownership takeover bridge；不建立 Member/Auth/Capability/ResourceScope runtime；不创建 supervisor/takeover/ownership abstraction。
3. **DEFER（推荐）**：事实 foundation 依赖 verified takeover occurrence producer + action authority（SHEEP-012 Capability+ResourceScope）+ trusted operator subject + transition preconditions + concurrency（I-103）+ ownership currentness；届时按 DP-169~172 + I-97~I-103 提交最小 prerequisite。

## 4. 边界
- 未改 schema v10；未实现 Claim/Release（SHEEP-070 DEFER）、AI/Human Ownership（SHEEP-071 DEFER）、Handoff Reason/Queue（SHEEP-072 DEFER）、Composer/Send/Attachments。
- 未改已 PASS：Composer/I-27~I-30、Delivery Attempt/I-33~I-41、Timeline/Queue、Customer/Product/Order Context、Ownership（DP-152~162/I-68~I-84）、Handoff（DP-163~168/I-85~I-96）。
- Renderer 不接触 SQLite；未联网；reference 树未读取。
