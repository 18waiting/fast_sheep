# Ownership / Claim / Release Fact-Readiness（SHEEP-070 Read First）

> **时点导航（2026-09-24）**：本文是限定任务的 Read First / Fact-Readiness 历史审查；对应 Controller 评审已 `PASS`，但通过的是审查/决策包，不表示所述产品能力已实现、事实源已就绪或获得新执行授权。正文“待 Owner PASS”与 `NOT_READY / DEFER` 保留当时原意。 当前任务状态/授权以 [PROJECT_STATE.json](../../project/PROJECT_STATE.json) 为准；验收溯源见 [对应报告](../reports/SHEEP-070-report.json)。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.4 · 日期：2026-08-29
> 定位：SHEEP-070 本轮仅执行 **Ownership / Claim / Release Fact-Readiness / Read First**（Owner 收紧：不授权 schema v11、不实现 Claim/Release IPC/UI、不建立 Member/Auth/Capability/ResourceScope runtime）。
> 结论：**NOT_READY / DEFER**——存在 typed ownership state vocabulary 与 snapshot persistence shape，但无 trusted human Member subject、无 claim/release authority、无 transition/concurrency semantics、无 IPC/UI；不为 Roadmap 造 fake Claim/Release UI。
> 边界：0 product code / 0 UI / 0 visual evidence；不改 schema v10；不进入 Claim/Release 产品实现，不进入下一 SHEEP。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-152 | CLAIM_RELEASE_UX_STARTS_FROM_THE_AUTHORIZED_ACTIVE_CONVERSATION（Renderer 不提供/授权 ownership target） |
| DP-153 | OWNERSHIP_ACTOR_IS_A_DOMAIN_FACT_DISTINCT_FROM_LLM_ROLES_AND_AUTOMATION_LEVEL |
| DP-154 | CLAIM_RELEASE_AUTHORITY_IS_NOT_IMPLIED_BY_ACTOR_IDENTITY |
| DP-155 | OWNERSHIP_STATE_VOCABULARY_REMAINS_TYPED_WITHOUT_UNVERIFIED_TRANSITION_ENGINE |
| DP-156 | OWNERSHIP_STATE_AND_HOLDER_FIELDS_FORM_SEPARATE_FACT_DIMENSIONS_UNTIL_VALID_COMBINATIONS_ARE_EVIDENCED（不自行补 CHECK） |
| DP-157 | OWNERSHIP_HOLDER_AND_OWNERSHIP_MUTATION_ACTOR_ARE_DISTINCT_FACTS |
| I-68 | MISSING_HUMAN_MEMBER_SUBJECT_MUST_FAIL_CLOSED_NOT_IMPLY_LOCAL_OWNER |
| I-69 | OWNERSHIP_SNAPSHOT_IS_NOT_AN_AUDIT_TRAIL |
| I-70 | CLAIM_RELEASE_READS_ARE_ANCHORED_TO_THE_AUTHORIZED_ACTIVE_CONVERSATION（stale-result guard） |
| I-71 | ABSENT_OWNERSHIP_STATE_MUST_NOT_BE_PRESENTED_AS_UNASSIGNED_WITHOUT_EVIDENCE |
| I-72 | OWNERSHIP_STATE_NAMES_DO_NOT_IMPLY_TRANSITION_EDGES_OR_STATE_EQUIVALENCE（不得自行推导 CLAIMED→ACTIVE、RELEASED=UNASSIGNED 等） |
| I-73 | ACTION_TARGET_STATE_MAPPING_DOES_NOT_ESTABLISH_COMPLETE_OWNERSHIP_MUTATION_SEMANTICS（不证明 source-state precondition、authority、holder mutation 或并发语义） |
| I-74 | CLAIM_RELEASE_MUTATION_MUST_NOT_USE_UNCONDITIONAL_LAST_WRITE_WINS（本轮不因此自行增加 version/CAS schema） |
| I-75 | AI_ACTIVE_OWNERSHIP_STATE_DOES_NOT_IMPLY_AI_SEND_AUTHORITY_OR_AUTOMATION_LEVEL |

## 2. Read First 证据（11 项 readiness）

### 2.1 OWNERSHIP_STATE_FACT_READINESS = PARTIAL
- SHEEP-014 8-state typed vocabulary（UNASSIGNED/AI_ACTIVE/ASSIGNED/CLAIMED/ACTIVE/HANDOFF_REQUIRED/SUPERVISOR_TAKEOVER/RELEASED）为 governance-confirmed vocabulary；`ownership_records.state` 为任意 TEXT（无 CHECK）。
- I-72：state 名 ≠ transition edges / state equivalence；不推导生命周期。
- DP-156：state 与 holder 字段是独立事实维度；合法组合语义未经验证，不自行补 CHECK。

### 2.2 OWNERSHIP_HOLDER_SEMANTICS_READINESS = NOT_READY
- `owner_kind`（member|ai 为 domain 层 typed；DB TEXT 无 CHECK）与 `owner_member_id`（opaque ref）组合语义未验证。
- DP-157：holder ≠ mutation actor；holder fact 与谁执行 claim/release 是不同事实。

### 2.3 OWNERSHIP_ACTOR_SUBJECT_READINESS = NOT_READY
- Member/Membership/Seat 仅为 domain type（SHEEP-011），无 runtime/持久化；无 trusted human Member/operator subject（SHEEP-066-PR2 `MANUAL_SEND_AUTHORIZATION_SUBJECT_READINESS=NOT_READY`）。
- I-68：缺 subject 时 fail closed，不推断 local Owner/default Member，不造 synthetic Member。

### 2.4 CLAIM_RELEASE_AUTHORITY_READINESS = NOT_READY
- DP-154：actor 身份不自动授权 claim/release；permission = SHEEP-012 Capability + ResourceScope，均未实现。
- 不自行发明 authority taxonomy；无 claim/release authority source。

### 2.5 OWNERSHIP_TRANSITION_SEMANTICS_READINESS = NOT_READY
- M1.5-R02 action→target-state mapping（claim/release/handoff/supervisor_takeover）存在，但 I-73：不证明 source-state precondition、authority、holder mutation、并发语义。
- DP-155：不建 unverified transition engine。

### 2.6 OWNERSHIP_CONCURRENCY_CONTROL_READINESS = NOT_READY
- `SqliteOwnershipRepository.save` = `INSERT OR REPLACE`（按 conversation 无条件 upsert）= **unconditional last-write-wins**（I-74）。
- 无 atomic precondition / compare-and-set；本轮不增加 version/CAS schema。

### 2.7 OWNERSHIP_PERSISTENCE_READINESS = PARTIAL
- `ownership_records`（0006）snapshot 表 + `SqliteOwnershipRepository`（snapshot upsert）存在且有 persistence 测试；**production Main 未接线**。
- I-69：snapshot ≠ transition/audit history。

### 2.8 CLAIM_RELEASE_IPC_READINESS = NOT_READY
- 无 claim/release/ownership typed IPC channel（desktop-ipc 42 canonical channels 无此类）；无 handler。

### 2.9 OWNERSHIP_SNAPSHOT_PRESENTATION_READINESS = NOT_READY
- 无 ownership snapshot projection / IPC / UI；I-70 锚定 authorized active conversation + stale guard；I-71 缺 row ≠ UNASSIGNED。

### 2.10 CLAIM_RELEASE_ACTION_PRESENTATION_READINESS = NOT_READY
- 无 action UI；无 subject/authority 可 gate action。
- M5 orchestrator `takeover_status`（ManualTakeoverController/TakeoverBreakerPolicy）是 AI 发送中断语义 surface，**不是** normalized ownership claim/release action，不写入 ownership_records。

### 2.11 CLAIM_RELEASE_UX_IMPLEMENTATION_READINESS = NOT_READY
- 上述任一缺失 → 产品实现不可行。

## 3. Decision Package（等待 Owner）
1. **不授权** ownership state CHECK、transition/event/audit table、version/CAS 或其它 v11 migration（schema v10 保持；I-74 不因本单元加 schema）。
2. **不实现** Claim/Release IPC/UI、ownership service/state machine；不建立 Member/Auth/Capability/ResourceScope runtime（不因 snapshot repository 已存在就创建 state machine/service）。
3. **DEFER（推荐）**：事实 foundation 依赖 trusted human Member/operator subject + claim/release authority（SHEEP-012 Capability + ResourceScope）+ transition/concurrency semantics；届时按 DP-152~157 + I-68~I-75 提交最小 prerequisite。
4. 若 Owner 认为存在足够事实支持最小 **read-only** snapshot 呈现，仍需先解决：authorized active conversation 锚定 + snapshot IPC + I-70/I-71 presentation 语义；本单元不默认批准。

## 4. 边界
- 未改 schema v10；未实现 Claim/Release、Handoff Reason/Queue、Supervisor Takeover（SHEEP-071~073）、Member/Auth/Session、Composer/Send/Attachments、Customer/Product/Order Context（DEFER）。
- 未改已 PASS：Composer/I-27~I-30、Delivery Attempt/I-33~I-41、Timeline/Queue、Customer/Product/Order Context 决策。
- Renderer 不接触 SQLite；未联网；reference 树未读取。
