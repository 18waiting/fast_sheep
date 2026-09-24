# Local Drafts Fact-Readiness（SHEEP-075 Read First）

> **时点导航（2026-09-24）**：本文是限定任务的 Read First / Fact-Readiness 历史审查；对应 Controller 评审已 `PASS`，但通过的是审查/决策包，不表示所述产品能力已实现、事实源已就绪或获得新执行授权。正文“待 Owner PASS”与 `NOT_READY / DEFER` 保留当时原意。 当前任务状态/授权以 [PROJECT_STATE.json](../../project/PROJECT_STATE.json) 为准；验收溯源见 [对应报告](../reports/SHEEP-075-report.json)。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.5 · 日期：2026-08-29
> 定位：SHEEP-075 本轮仅执行 **Local Drafts Fact-Readiness / Read First**（Owner 收紧：不授权 schema v11、不实现 draft persistence/IPC、不改 Composer UI）。
> 结论：**NOT_READY / DEFER（author scope + lifecycle/concurrency/durability 未定义）**——draft 当前是 renderer 内以 conversationId 为 key 的 ephemeral mutable working state；无 author scope、无持久化、无 revision/version、clearing 未匹配 draft version；不为 Roadmap 造 fake draft persistence。
> 边界：0 product code / 0 UI / 0 visual evidence；不改 schema v10；不进入 Local Draft persistence 产品实现，不进入 SHEEP-076。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-179 | DRAFT_IS_LOCAL_MUTABLE_WORKING_STATE_BOUND_TO_CONVERSATION_AND_EXPLICIT_AUTHOR_SCOPE（Draft 是 mutable work state，不是 delivered Message fact） |
| DP-180 | DRAFT_IS_DISTINCT_FROM_DELIVERED_MESSAGE_FACT_SEND_INTENT_AND_DELIVERY_ATTEMPT（不得用 delivery_attempt payload 代替当前 editable draft） |
| DP-181 | DRAFT_PERSISTENCE_REQUIRES_EXPLICIT_LIFECYCLE_CLEARING_AND_DURABILITY_SEMANTICS（create/update/clear + autosave/debounce/switch/close 何时算 durable；本轮不实现） |
| DP-182 | DRAFT_AUTHOR_SCOPE_IS_NOT_INFERRED_FROM_CONVERSATION_OR_WORKSPACE_MERCHANT（核验 durable Draft 是 conversation+Member / Seat / local installation / other scope） |
| DP-183 | DRAFT_REHYDRATION_IS_CONVERSATION_SCOPED_AND_NEED_NOT_BE_GLOBAL_STARTUP_RECOVERY（不得 startup 一次性读取所有草稿） |
| DP-184 | DRAFT_CLEARING_BY_SEND_RESULT_REQUIRES_MATCHING_THE_CAPTURED_DRAFT_VERSION_OR_EQUIVALENT_IDENTITY |
| I-120 | AUTHORIZED_DRAFT_NOT_FOUND_MEANS_NO_SAVED_DRAFT_WHILE_READ_FAILURE_OR_UNAVAILABLE_MUST_NOT_MASQUERADE_AS_EMPTY（合法 NOT_FOUND 可初始化空 Composer；DB/auth/IPC failure 不得伪装为空） |
| I-121 | DRAFT_READS_ARE_ANCHORED_TO_THE_AUTHORIZED_ACTIVE_CONVERSATION（未来 author scope 由 Main trusted context 解析，Renderer 不提供可信 Member/author target） |
| I-122 | DRAFT_PAYLOAD_IS_NOT_EMITTED_TO_LOGS_OR_TELEMETRY_BY_DEFAULT |
| I-123 | DRAFT_PERSISTENCE_MUST_NOT_IMPLY_SYNC_OR_SEND_CAPABILITY（Phase 12 前不得建立 draft sync） |
| I-124 | PERSISTED_DRAFT_MUST_NOT_BE_SHARED_ACROSS_HUMAN_SUBJECTS_WITHOUT_AN_EXPLICIT_AUTHOR_SCOPE_CONTRACT |
| I-125 | DRAFT_PERSISTENCE_PRESERVES_AUTHORED_TEXT_EXACTLY_WITHOUT_TRIM_OR_NORMALIZATION（trim 仅用于 send-empty validation，不改写 persisted draft） |
| I-126 | OLDER_SEND_RESULT_MUST_NOT_CLEAR_OR_OVERWRITE_A_NEWER_DRAFT_REVISION |
| I-127 | DRAFT_PERSISTENCE_FAILURE_MUST_NOT_DISCARD_CURRENT_EDIT_OR_FABRICATE_DURABLE_SAVE_SUCCESS |
| I-128 | LATE_DRAFT_REHYDRATION_RESULT_MUST_NOT_OVERWRITE_A_NEWER_IN_MEMORY_EDIT_OR_WRONG_CONVERSATION_CONTEXT |

## 2. Read First 证据（15 项 readiness）

### 2.1 DRAFT_WORKING_STATE_SEMANTICS_READINESS = PARTIAL
- Draft 已确认是 renderer in-memory mutable working state：`state.composerDrafts: Record<string,string>` 以 conversationId 为 key（DP-108/109）；Composer 读取 `composerDrafts[activeId] ?? ""`。
- 非 delivered Message fact（DP-180）；但 durable working-state semantics（author scope/lifecycle）未定义。

### 2.2 DRAFT_AUTHOR_SCOPE_READINESS = NOT_READY
- 当前 ephemeral map **仅以 conversationId keyed，无 author scope**（DP-182/I-124）。
- 无 trusted human Member/operator subject（SHEEP-066-PR2 `MANUAL_SEND_AUTHORIZATION_SUBJECT_READINESS=NOT_READY`）；durable Draft 是 conversation+Member / Seat / local installation / other scope **未决定**；不因当前 ephemeral keyed conversationId 永久决定所有 operator 共享一份 draft。

### 2.3 DRAFT_CARDINALITY_READINESS = NOT_READY
- 当前 ephemeral 为 conversationId→draft 1:1；durable cardinality 依 author scope（可能 conversation+author 各一份）；不预设主键/cardinality/revision 字段名（约束 #18）。

### 2.4 DRAFT_LIFECYCLE_SEMANTICS_READINESS = NOT_READY
- create/update/clear 的 typed persistence 语义未定义；autosave/debounce/switch/close 何时算 durable 未定义（DP-181）。

### 2.5 DRAFT_WRITE_DURABILITY_SEMANTICS_READINESS = NOT_READY
- 何时写入算 durable 未定义；I-127：persistence failure 不得丢弃当前 edit、不得伪造 durable save success（本轮不实现，failure semantics 仅核验）。

### 2.6 DRAFT_REVISION_CONCURRENCY_READINESS = NOT_READY
- 无 revision/version metadata；I-126：older send result 不得 clear/overwrite newer draft revision。
- Revision/change metadata 仅在出现真实 local consumer（如 I-126 concurrency）时建立；不因 R-06 sync-ready 顺手加 Cloud/Outbox/sync metadata（约束 #13）。

### 2.7 DRAFT_CLEARING_SEMANTICS_READINESS = PARTIAL
- I-28 in-memory clearing 存在（`applyComposerSendResult`：sent 清 captured conversation draft、failed 保留、c1 不碰 c2）。
- **gap**：clearing 仅按 conversationId 无条件清，未匹配 captured draft version/identity（DP-184/I-126）——older "sent" 理论上可清掉之后写出的 newer draft（当前生产 Send disabled 无真实 in-flight，但语义缺口真实）。

### 2.8 DRAFT_PERSISTENCE_CONTRACT_READINESS = NOT_READY
- 无 draft table/repository/producer/path；v11 未授权；禁止只有表无 producer；若未来持久化须共享 Main SQLite lifecycle（DP-90 模式）。

### 2.9 DRAFT_REHYDRATION_READINESS = NOT_READY
- DP-183：draft rehydration 为 **conversation-scoped**，非全局 startup recovery（区别于 PR1 delivery recovery）；I-128：late rehydration 不得覆盖 newer in-memory edit 或错误 conversation context；无 rehydration path。

### 2.10 DRAFT_AUTHORIZATION_READINESS = PARTIAL
- I-121：draft read 锚定 authorized active conversation（现有 in-memory 走 activeConversationId）；durable drafts 的 author scope 必须由 Main trusted context 解析；Renderer 不提供可信 Member/author target。

### 2.11 DRAFT_BACKUP_RESTORE_SEMANTICS_READINESS = NOT_READY
- 当前 drafts 不在 SQLite → 不在 backup 内；若未来 v11 将 draft 表放入 Main SQLite，现有 backup-manager（VACUUM INTO + restore）会一并覆盖，无需特殊机制（约束 #17）；持久化 proposal 时核验 backup/restore semantics。

### 2.12 DRAFT_IPC_READINESS = NOT_READY
- 无 draft typed IPC（desktop-ipc 无 draft channel）；无 handler。

### 2.13 DRAFT_PRIVACY_READINESS = PARTIAL
- I-122：draft payload 不进 logs/telemetry/error strings（当前 renderer-only drafts 不进入任何日志）。
- I-125：持久化须原样保留 authored text（不 trim/不 normalization）；现有 composer 仅 `draft.trim() === ""` 用于 send-disabled 判断，从不改写 draft。

### 2.14 DRAFT_PRESENTATION_READINESS = PARTIAL
- Composer draft UI 存在（in-memory）；I-120：authorized draft NOT_FOUND = 无 saved draft → 可初始化空 Composer；但 read failure/unavailable（DB/auth/IPC）不得伪装为空（未来持久化路径）。

### 2.15 LOCAL_DRAFTS_IMPLEMENTATION_READINESS = NOT_READY
- 上述任一缺失 → 产品实现不可行。

## 3. Decision Package（等待 Owner）
1. **不授权** schema v11 / draft table / draft IPC / Composer UI 变更；不实现 Outbox/sync（Phase 12）、attachment drafts（SHEEP-065 DEFER）、Unread。
2. **author scope 不臆造**：durable Draft 的 author scope（conversation+Member / Seat / local installation）必须待 trusted Member/operator runtime 建立时由产品决策，不因当前 ephemeral keyed conversationId 决定共享。
3. **DEFER（推荐）**：draft persistence 需 author scope contract（DP-182/I-124）+ lifecycle/durability semantics（DP-181）+ revision/concurrency（I-126）+ clearing-by-version（DP-184）+ conversation-scoped rehydration（DP-183/I-128）+ backup/restore semantics；届时按 DP-179~184 + I-120~I-128 提交最小 v11 prerequisite。

## 4. 边界
- 未改 schema v10；未实现 draft persistence/IPC；未改 Composer UI；未实现 SHEEP-076（Audit Trail）、Composer/Send/Attachments/Unread。
- 未改已 PASS：Composer/I-27~I-30、Delivery Attempt/I-33~I-41、Timeline/Queue、Ownership/Handoff/Supervisor Takeover、Reload/Crash Recovery（DP-173~177/I-105~I-114）、Startup Rehydration（DP-178/I-115~I-119）。
- Renderer 不接触 SQLite；未联网；reference 树未读取。
