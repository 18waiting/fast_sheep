# Conversation Audit Trail Fact-Readiness（SHEEP-076 Read First）

> **时点导航（2026-09-24）**：本文是限定任务的 Read First / Fact-Readiness 历史审查；对应 Controller 评审已 `PASS`，但通过的是审查/决策包，不表示所述产品能力已实现、事实源已就绪或获得新执行授权。正文“待 Owner PASS”与 `NOT_READY / DEFER` 保留当时原意。 当前任务状态/授权以 [PROJECT_STATE.json](../../project/PROJECT_STATE.json) 为准；验收溯源见 [对应报告](../reports/SHEEP-076-report.json)。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.5 · 日期：2026-08-29
> 定位：SHEEP-076 本轮仅执行 **Conversation Audit Trail Fact-Readiness / Read First**（Owner 收紧：不授权 schema v11、不实现 Audit IPC/UI/service）。
> 结论：**NOT_READY / DEFER**——多数 conversation audit 的 mutation producer（Ownership/Handoff/Supervisor/Send）均 DEFER；Phase 1 mutation boundary 无 audit hook；actor/temporal/data-class/retention semantics 未定义；GATE-P4 条件按"未来 Audit writes 不得绕过 boundary"解读（非 vacuous PASS，也非 auto FAIL）。
> 边界：0 product code / 0 UI / 0 visual evidence；不改 schema v10；不进入 Audit Trail 产品实现，不进入 GATE-P4 最终裁决。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-185 | CONVERSATION_AUDIT_TRAIL_USES_TYPED_APPEND_ONLY_EVENT_FACTS_NOT_FREE_FORM_LOGS（append-only = normal operation 不原地改写；retention/deletion 仍属独立 Owner DATA policy） |
| DP-186 | CONVERSATION_AUDIT_EVENTS_ARE_BOUND_TO_THE_AUTHORIZED_CONVERSATION_AND_MERCHANT_CONTAINED |
| DP-187 | CONVERSATION_AUDIT_EVENTS_REQUIRE_VERIFIED_MUTATION_PRODUCERS_NOT_PRESENTATION_INFERENCE |
| DP-188 | CONVERSATION_AUDIT_IS_DISTINCT_FROM_PRIMARY_DOMAIN_FACTS_LEARNING_AUDIT_DIAGNOSTICS_AND_TELEMETRY |
| DP-189 | AUDITED_MUTATION_AND_AUDIT_EVENT_PERSISTENCE_ARE_ATOMIC_OR_RECOVERABLY_IDEMPOTENT（Phase1 mutation boundary 需 same-transaction hook / mutation identity / recoverable linkage） |
| DP-190 | AUDIT_ACTOR_PROVENANCE_AND_ACTION_AUTHORITY_ARE_DISTINCT_FACTS（actor 是谁不证明 action 被授权；不为 Audit 造 synthetic Member） |
| I-130 | AUDIT_EVENTS_ARE_DISTINCT_FROM_MESSAGE_FACTS_DELIVERY_ATTEMPTS_AND_M10_LEARNING_AUDIT（由 DP-188 覆盖更广 separation） |
| I-131 | ABSENT_AUDIT_FACTS_MUST_NOT_BE_PRESENTED_AS_NO_ACTIVITY_WITHOUT_EVIDENCE（coverage/incomplete history 语义需考虑；本轮不设计 coverage table） |
| I-132 | CONVERSATION_AUDIT_DETAIL_READS_ARE_ANCHORED_TO_AN_AUTHORIZED_CONVERSATION（不锁死未来 merchant-scoped Supervisor Audit query） |
| I-133 | AUDIT_DETAILS_ARE_NOT_EMITTED_TO_LOGS_OR_TELEMETRY_BY_DEFAULT |
| I-134 | AUDIT_RETENTION_DELETION_REQUIRE_OWNER_DATA_DECISION（R-06 DATA-DECISION-GATE） |
| I-135 | PRIMARY_DOMAIN_FACTS_MUST_NOT_BE_DUPLICATED_INTO_AUDIT_WITHOUT_AN_EXPLICIT_AUDIT_REQUIREMENT（Message/DeliveryAttempt 等权威事实不机械复制 audit history） |
| I-136 | AUDIT_EVENT_EMISSION_MUST_BE_IDEMPOTENT_PER_AUDITED_MUTATION_OCCURRENCE（本轮不预设 event id/dedupe schema） |
| I-137 | AUDIT_EVENT_PAYLOADS_ARE_TYPE_SPECIFIC_AND_MINIMIZED_NOT_ARBITRARY_METADATA_BAGS |
| I-138 | AUDIT_EVENTS_MUST_NOT_COPY_MESSAGE_DRAFT_CUSTOMER_OR_OTHER_BUSINESS_CONTENT_UNLESS_THE_AUDIT_REQUIREMENT_EXPLICITLY_NEEDS_THAT_FACT（优先引用 typed domain identity） |
| I-139 | AUDIT_EVENT_CORRECTION_OR_RECONCILIATION_APPENDS_NEW_FACTS_INSTEAD_OF_REWRITING_NORMAL_OPERATION_HISTORY |

## 2. Read First 证据（15 项 readiness）

### 2.1 CONVERSATION_AUDIT_FACT_READINESS = NOT_READY
- 无 audit event fact/table/semantics；DP-185 typed append-only 契约已定义，但无实现事实。

### 2.2 AUDIT_EVENT_SCOPE_TAXONOMY_READINESS = NOT_READY
- 需 audit 的 conversation mutation（ownership 状态变迁 / claim-release-handoff-takeover / send attempt / message ingestion / draft lifecycle？）范围未定义；多数 producer DEFER；无 taxonomy。

### 2.3 AUDIT_MUTATION_PRODUCER_READINESS = NOT_READY
- Ownership/Handoff/Supervisor/Send mutation producer 均 DEFER（SHEEP-066/070~073）；message ingestion 有 repository 写路径但无 audit emission；无 audit producer。

### 2.4 AUDIT_ACTOR_PROVENANCE_READINESS = NOT_READY
- 无 trusted Member/operator subject（SHEEP-066-PR2）；DP-190 actor ≠ authority；不为 Audit 造 synthetic Member。

### 2.5 AUDIT_EVENT_SEMANTICS_READINESS = NOT_READY
- event type/payload/idempotency/correction semantics 未定义（I-136/I-137/I-139）。

### 2.6 AUDIT_EVENT_TEMPORAL_SEMANTICS_READINESS = NOT_READY
- audit event 时间语义未定义；不得机械复用 Message.occurred_at / updated_at（约束 #17）；需明确 audited mutation 记录/观察时间与 source time 语义（DP-87 模式类比）。

### 2.7 AUDIT_MUTATION_ATOMICITY_IDEMPOTENCY_READINESS = NOT_READY
- Phase 1 mutation boundary（typed repositories）**无 same-transaction audit hook / mutation identity / recoverable linkage**；DP-189/I-136 要求业务 mutation 成功且 audit 不静默丢失、audit 不先于 mutation 成功。

### 2.8 AUDIT_PERSISTENCE_READINESS = NOT_READY
- 无 audit table（v11 未授权）；无 repository/path；禁止只有表无 producer。

### 2.9 AUDIT_DATA_CLASSIFICATION_READINESS = PARTIAL
- I-138 模式清晰：优先引用 typed domain identity（conversation id / actor ref / action type / typed refs），不复制业务正文；payload taxonomy（I-137）未定义。

### 2.10 AUDIT_RETENTION_SEMANTICS_READINESS = NOT_READY
- R-06 DATA-DECISION-GATE：retention/deletion 为 Owner DATA 决策；本轮不决定期限/purge 策略（I-134）。

### 2.11 AUDIT_BACKUP_RESTORE_SEMANTICS_READINESS = PARTIAL
- audit 若入 Main SQLite（v11）将机械覆盖于现有 backup-manager（VACUUM INTO + restore）；storage/retention policy 未决（R-06）；无特殊 backup 机制。

### 2.12 AUDIT_AUTHORIZATION_READINESS = PARTIAL
- I-132：audit detail read 锚定 authorized conversation；不锁死未来 merchant-scoped Supervisor Audit query；WorkspaceMerchant containment 模式适用。

### 2.13 AUDIT_IPC_PRESENTATION_READINESS = NOT_READY
- 无 audit typed IPC / UI。

### 2.14 GATE_P4_AUDIT_MUTATION_BOUNDARY_READINESS = PARTIAL
- GATE-P4 原文（Roadmap R-07）："Conversation / Message / Context / **Audit** 写入已通过 Phase 1 mutation boundary（可观察、可挂接未来 Outbox）" → 要求的是 **未来 Audit writes（及当前 conversation/message writes）不得绕过 typed repository/mutation boundary**，**不是**要求当前 mutations 已生成 Audit events（约束 #19）。
- 现状核验（约束 #20）：production 域数据写入均经 typed repositories / repository-bound functions（message-ingestion→SqliteMessageRepository；createAuthorizedDeliveryAttempt/runDeliveryAttempt→SqliteDeliveryAttemptRepository；conversations/stores/platformAccounts/jobs/products 等均经 repo）；feature 层无裸 domain SQL——仅 smoke-probe/packaged-smoke（read-only 诊断/临时 probe 表）与 persistence 内部（db/migration/backup/repositories）合法使用 conn。
- 结论：当前 mutation boundary 合规；无 Audit producer/table 既不是 vacuous PASS（audit events 不存在）也不是 auto FAIL（gate 条件为 boundary 合规而非已有 audit UI）；GATE-P4 最终裁决单独决定（约束 #24）。

### 2.15 CONVERSATION_AUDIT_TRAIL_IMPLEMENTATION_READINESS = NOT_READY
- 上述任一缺失 → 产品实现不可行。

## 3. Decision Package（等待 Owner）
1. **不授权** v11 / Audit table / Outbox / Sync / retention-deletion implementation（约束 #23）。
2. **不实现** Audit IPC/UI/service/event registry（约束 #22）；不把 M10 learning audit 当 conversation audit（DP-188/I-130）。
3. **DEFER（推荐）**：audit trail 依赖 verified mutation producers（Ownership/Handoff/Supervisor/Send——均 DEFER）+ Phase1 mutation-boundary audit hook（DP-189）+ actor provenance（DP-190）+ temporal/data-class semantics + Owner DATA decision（retention，I-134）；届时按 DP-185~190 + I-130~I-139 提交最小 v11 prerequisite。
4. **GATE-P4 单独裁决**：本 Read First 仅提供 boundary-compliance 事实（PARTIAL/合规现状），不代替 GATE-P4 最终判定。

## 4. 边界
- 未改 schema v10；未实现 Audit Trail / audit IPC/UI；未实现 retention/deletion/Outbox/sync；未改已 PASS：Composer/I-27~I-30、Delivery Attempt/I-33~I-41、Timeline/Queue、Ownership/Handoff/Supervisor、Reload/Crash Recovery、Startup Rehydration、Local Drafts。
- Renderer 不接触 SQLite；未联网；reference 树未读取。
