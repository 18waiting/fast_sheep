# Reload / Crash Recovery Fact-Readiness（SHEEP-074 Read First）

> **时点导航（2026-09-24）**：本文的 `production startup/rehydration 未接入` 是 SHEEP-074 Read First 当时的缺口。随后 [SHEEP-074-PR1](fast-sheep-pr1-startup-rehydration-wiring.md) 获 `PASS / CLOSED`，仅将 merchant-scoped Delivery Attempt recovery 接入 startup；Background Job / Import recovery 仍未接入，不能把局部接线写成全面 READY。 当前任务状态/授权以 [PROJECT_STATE.json](../../project/PROJECT_STATE.json) 为准；验收溯源见 [对应报告](../reports/SHEEP-074-report.json)。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.5 · 日期：2026-08-29
> 定位：SHEEP-074 本轮仅执行 **Reload / Crash Recovery Fact-Readiness / Read First**（Owner 收紧：不授权 schema v11、不实现 recovery IPC/UI/service/engine）。
> 结论：**NOT_READY / DEFER（wiring gap）**——持久化 facts durable、recovery helper（delivery attempt / background job / import resume）capability 存在且经测试，但 **production startup/rehydration 未接入**（I-110）；renderer reload 仅 re-bootstrap（in-memory state 丢失）；不为 Roadmap 造 fake recovery。
> 边界：0 product code / 0 UI / 0 visual evidence；不改 schema v10；不进入 SHEEP-074 产品实现，不进入 SHEEP-075。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-173 | RECOVERY_IS_FACT_BASED_AND_STATE_OWNER_SPECIFIC（逐项确认 state owner/durability/recovery source；不建万能 recovery engine） |
| DP-174 | RENDERER_RELOAD_MAIN_PROCESS_CRASH_AND_FULL_APP_RESTART_ARE_DISTINCT_RECOVERY_BOUNDARIES（Main crash readiness = 下一次 process startup 后 state reconstruction；不授权 watchdog/auto relaunch） |
| DP-175 | EPHEMERAL_RUNTIME_STATE_IS_NOT_PROMISED_ACROSS_RESTART_WITHOUT_PERSISTENCE_CONTRACT（Renderer reload 恢复依真实 state owner，不一律要求 SQLite） |
| DP-176 | RECOVERY_SEMANTICS_FOLLOW_STATE_DURABILITY_AND_EXTERNAL_SIDE_EFFECT_CLASS |
| DP-177 | BACKUP_RESTORE_IS_DISASTER_RECOVERY_NOT_ORDINARY_RUNTIME_CRASH_RECOVERY |
| I-105 | RECOVERY_MUST_NOT_FABRICATE_STATE |
| I-106 | AMBIGUOUS_EXTERNALLY_EFFECTFUL_IN_FLIGHT_WORK_RECOVERS_AS_UNKNOWN_NOT_SUCCESS_OR_SAFE_RETRY（仅可能产生外部/durable side effect 且 outcome 不可判定的 in-flight work 必须 UNKNOWN；纯 transient computation 不要求伪造 UNKNOWN business fact） |
| I-107 | RECOVERED_ACTIVE_CONVERSATION_SELECTOR_IS_UNTRUSTED_UNTIL_REAUTHORIZED |
| I-108 | RECOVERY_READS_ARE_ANCHORED_TO_THE_AUTHORIZED_WORKSPACE_MERCHANT |
| I-109 | DRAFT_SURVIVAL_ACROSS_RECOVERY_BOUNDARIES_FOLLOWS_VERIFIED_STATE_OWNERSHIP_AND_EXPLICIT_DURABILITY_CONTRACT（不借 074 实现 SHEEP-075） |
| I-110 | DURABLE_ROW_EXISTENCE_DOES_NOT_PROVE_STARTUP_RECOVERY_WIRING_OR_RESUMABILITY |
| I-111 | RECOVERY_MUST_NOT_REPLAY_EXTERNAL_SIDE_EFFECTS_WITHOUT_IDEMPOTENCY_OR_RECONCILIATION |
| I-112 | ORDINARY_CRASH_MUST_NOT_TRIGGER_BACKUP_ROLLBACK_WITHOUT_CORRUPTION_EVIDENCE_OR_EXPLICIT_RESTORE_DECISION |
| I-113 | INVALID_OR_STALE_RECOVERED_SELECTION_FALLS_BACK_TO_NO_SELECTION_NOT_AN_INFERRED_WORK_ITEM |
| I-114 | LATE_ASYNC_RESULTS_AFTER_RELOAD_OR_RESTART_MUST_MATCH_THE_CURRENT_OPERATION_AND_CONVERSATION_CONTEXT |

## 2. Read First 证据（15 项 readiness）

### 2.1 RUNTIME_STATE_INVENTORY_READINESS = PARTIAL
- 本轮产出逐 state 盘点（owner/durable|ephemeral/外部副作用/Renderer reload 行为/Main|full restart 行为/recovery source）——见下表：
  - normalized conversations/messages/stores/platformAccounts/workspaceMerchant：Main/SQLite，durable，无外部副作用，reopen 可恢复（recovery source = SQLite）。
  - delivery_attempts：Main/SQLite，durable，**可能产生外部发送副作用**；IN_FLIGHT→UNKNOWN 恢复（DP-128），无自动 retry；**未接入 production startup**（I-110）。
  - background jobs：Main/SQLite，durable，可能产生 mutation 副作用；recoverAll 仅 idempotent replay；**未接入 production startup**。
  - legacy import session：Main（production composition 默认 InMemoryImportSessionStore），session 级 resume capability 存在；无 startup trigger。
  - M5 orchestrator mode/countdown/takeover/suggestion：Main in-memory，transient，无外部副作用（纯 runtime control）。
  - renderer active selection/drafts/mode/suggestion view：Renderer in-memory（无 localStorage/sessionStorage），reload 丢失 → boot 重新 apply bootstrap。

### 2.2 RECOVERY_BOUNDARY_CLASSIFICATION_READINESS = READY / CONTRACT_CONFIRMED
- DP-174：renderer reload / Main process crash / full app restart 三边界已确认；Main crash readiness = 下次 process startup 的 state reconstruction；不授权 watchdog/auto relaunch。

### 2.3 PERSISTED_FACT_DURABILITY_READINESS = READY / CONTRACT_CONFIRMED
- SQLite close→reopen durability 对 normalized facts 已验证（persistence durability tests PASS）；不等同 startup rehydration。

### 2.4 STARTUP_REHYDRATION_WIRING_READINESS = NOT_READY
- `recoverInFlightAttempts`（DP-128）存在+导出+测试，但 **apps/desktop production 无调用**（bootstrap 内仅 in-memory repo 的 recoverInFlight helper）；background job `recover()` 同样未在 production startup 调用（I-110）。

### 2.5 DELIVERY_ATTEMPT_RECOVERY_READINESS = PARTIAL
- recovery semantics 正确（DP-128 IN_FLIGHT→UNKNOWN；I-33 不自动 retry；I-106/I-111）；capability+测试存在；**production startup trigger 未接入**。

### 2.6 BACKGROUND_JOB_RECOVERY_READINESS = PARTIAL
- `recoverAll/recoverJob`（idempotent-only replay，非 idempotent → FAILED）存在 + M10 smoke；**production startup trigger 未接入**；scope 仅 RUNNING/CANCELLING job。

### 2.7 IMPORT_RECOVERY_READINESS = PARTIAL
- ImportOrchestrator `resumeSession`（idempotent resume + backup_id 复用）capability 存在；production composition 默认 `InMemoryImportSessionStore`；无 startup trigger。

### 2.8 BACKUP_DISASTER_RECOVERY_SEPARATION_READINESS = READY / CONTRACT_CONFIRMED
- DP-177：backup/restore 是 disaster recovery（VACUUM INTO + explicit restore + rotation），非普通 runtime crash recovery；I-112：普通 crash 默认 reopen current DB，无自动 backup rollback 代码。

### 2.9 RENDERER_RELOAD_RECOVERY_READINESS = PARTIAL
- boot 重新 apply bootstrap state；renderer 无 localStorage/sessionStorage；active selection/drafts 丢失 → no-selection fallback（I-113）；late async stale-context（I-114）需按现有 I-14/I-7 stale guard 模式核验。

### 2.10 MAIN_CRASH_RECOVERY_READINESS = NOT_READY
- recovery helper 未接入下一次 process startup 的 state reconstruction；无 watchdog/auto-relaunch（DP-174）。

### 2.11 FULL_APP_RESTART_RECOVERY_READINESS = PARTIAL
- 持久化 facts durable（2.3）；ephemeral state 无跨 restart promise（DP-175）；rehydration wiring 未 ready（2.4）。

### 2.12 EPHEMERAL_STATE_RECOVERY_READINESS = PARTIAL
- DP-175/I-109：drafts/suggestion/mode 为 ephemeral；renderer reload 行为依 state owner；无持久化 promise；SHEEP-075 不提前实现。

### 2.13 EXTERNAL_SIDE_EFFECT_RECONCILIATION_READINESS = PARTIAL
- delivery attempt IN_FLIGHT→UNKNOWN（DP-128/I-106）；job recovery 仅 idempotent replay（I-111）；import resume idempotent；纯 transient computation 不伪造 UNKNOWN business fact（I-106 收紧）。

### 2.14 RECOVERY_AUTHORIZATION_READINESS = READY / CONTRACT_CONFIRMED
- I-107/I-108：recovered active conversation selector 为 untrusted，须重新 Conversation resolve + WorkspaceMerchant containment；I-113：无效/陈旧 selector fallback 到 no-selection，不自动选 Queue 第一条/ambient Store 会话。

### 2.15 RELOAD_CRASH_RECOVERY_IMPLEMENTATION_READINESS = NOT_READY
- 上述 wiring 缺口 → 产品实现不可行。

## 3. Decision Package（等待 Owner）
1. **不授权** active-selection persistence、runtime checkpoint、AI operation persistence、recovery table、v11 migration（schema v10 保持）；Draft persistence 留 SHEEP-075、Audit 留 SHEEP-076。
2. **不实现** recovery IPC/UI/service/engine；不建 watchdog/auto-relaunch；不实现 backup 自动 rollback（I-112）。
3. **最小 prerequisite（推荐，若 Owner 批准）**：将既有 recovery helper（`recoverInFlightAttempts` DP-128 + background job `recoverAll`）接入 production startup rehydration（含 idempotency/failure/trigger 语义）；否则 **DEFER**。Import resume 是否需 durable session store 由届时事实决定。

## 4. 边界
- 未改 schema v10；未实现 draft persistence（SHEEP-075）、Conversation Audit Trail（SHEEP-076）、Composer/Send/Attachments/Unread。
- 未改已 PASS：Composer/I-27~I-30、Delivery Attempt/I-33~I-41、Timeline/Queue、Customer/Product/Order Context、Ownership（DP-152~162/I-68~I-84）、Handoff（DP-163~168/I-85~I-96）、Supervisor Takeover（DP-169~172/I-97~I-104）。
- Renderer 不接触 SQLite；未联网；reference 树未读取。
