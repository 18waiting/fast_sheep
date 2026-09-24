# Handoff Reason / Queue Fact-Readiness（SHEEP-072 Read First）

> **时点导航（2026-09-24）**：本文是限定任务的 Read First / Fact-Readiness 历史审查；对应 Controller 评审已 `PASS`，但通过的是审查/决策包，不表示所述产品能力已实现、事实源已就绪或获得新执行授权。正文“待 Owner PASS”与 `NOT_READY / DEFER` 保留当时原意。 当前任务状态/授权以 [PROJECT_STATE.json](../../project/PROJECT_STATE.json) 为准；验收溯源见 [对应报告](../reports/SHEEP-072-report.json)。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.4 · 日期：2026-08-29
> 定位：SHEEP-072 本轮仅执行 **Handoff Reason / Queue Fact-Readiness / Read First**（Owner 收紧：不授权 schema v11、不实现 handoff IPC/UI/service/queue mutation）。
> 结论：**NOT_READY / DEFER**——存在 worker/orchestrator runtime handoff decision（含 free-form reason）与 legacy transfer_rules 配置，但无 production handoff occurrence/reason/target fact、无 HANDOFF_REQUIRED producer、无 queue handoff 维度；不为 Roadmap 造 fake handoff reason/queue。
> 边界：0 product code / 0 UI / 0 visual evidence；不改 schema v10；不进入 SHEEP-072 产品实现，不进入下一 SHEEP。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-163 | HANDOFF_REASON_FACT_REQUIRES_VERIFIED_PRODUCER_WHILE_NORMALIZED_REASON_CLASSIFICATION_REQUIRES_SEPARATE_EVIDENCE（verified free-form source reason 可是事实；不得从 free text/rule keyword/order_state 推导统一 taxonomy） |
| DP-164 | HANDOFF_QUEUE_IS_A_CONVERSATION_QUERY_DIMENSION_DISTINCT_FROM_HANDOFF_MUTATION |
| DP-165 | HANDOFF_REASON_AND_HANDOFF_TARGET_ARE_SEPARATE_FACTS |
| DP-166 | HANDOFF_REASON_IS_SCOPED_TO_A_SPECIFIC_HANDOFF_OCCURRENCE_WITHIN_AN_AUTHORIZED_CONVERSATION（不预设 conversation.handoff_reason 单值覆盖模型） |
| DP-167 | HANDOFF_DECISION_HANDOFF_OCCURRENCE_AND_OWNERSHIP_STATE_ARE_DISTINCT_FACT_LAYERS |
| DP-168 | HANDOFF_TARGET_SELECTOR_AND_RESOLVED_HUMAN_ASSIGNEE_ARE_DISTINCT_FACTS（"人工"/transfer_to 字符串不得自动升级为 Member/operator target） |
| I-85 | WORKER_OR_ORCHESTRATOR_HANDOFF_DECISIONS_ARE_NOT_NORMALIZED_HANDOFF_REASON_FACTS_WITHOUT_PRODUCER_CONTRACT |
| I-86 | HANDOFF_REASON_VOCABULARY_MUST_NOT_BE_INVENTED_FROM_RULE_KEYWORDS_OR_FREE_TEXT |
| I-87 | HANDOFF_ABSENCE_IS_THREE_WAY（无 verified occurrence / occurrence 已知但 reason 缺失 / known reason）；不得统一伪装成"无 handoff"或"原因未知" |
| I-88 | HANDOFF_DETAIL_READS_ARE_ANCHORED_TO_THE_AUTHORIZED_CONVERSATION |
| I-89 | HANDOFF_REASON_MUST_NOT_BE_STORED_AS_A_SINGLE_OVERWRITABLE_CONVERSATION_ATTRIBUTE_WITHOUT_OCCURRENCE_SEMANTICS |
| I-90 | RUNTIME_HANDOFF_DECISION_DOES_NOT_BY_ITSELF_MUTATE_OR_ESTABLISH_HANDOFF_REQUIRED_OWNERSHIP_STATE |
| I-91 | HANDOFF_TARGET_DOES_NOT_IMPLY_RESOLVED_OWNERSHIP_HOLDER |
| I-92 | HANDOFF_QUEUE_QUERIES_REMAIN_MERCHANT_SCOPED_WORK_SELECTION_PROJECTIONS_DISTINCT_FROM_ACTIVE_CONVERSATION_STATE（继承现有 merchant/store/platform query boundary） |
| I-93 | HANDOFF_QUEUE_MEMBERSHIP_DOES_NOT_IMPLY_PRIORITY_ORDERING_OR_MUTATION_AUTHORITY |
| I-94 | HANDOFF_REQUIRED_STATE_DOES_NOT_IMPLY_A_KNOWN_HANDOFF_REASON_AND_HANDOFF_REASON_DOES_NOT_IMPLY_CURRENT_HANDOFF_REQUIRED_STATE |
| I-95 | HANDOFF_INTERNAL_TRACE_MUST_NOT_BE_PROMOTED_TO_USER_VISIBLE_REASON_OR_NORMALIZED_FACT_WITHOUT_AN_EXPLICIT_SAFE_PROVENANCE_CONTRACT |
| I-96 | HANDOFF_REASON_AND_TARGET_FACTS_ARE_NOT_EMITTED_TO_LOGS_OR_TELEMETRY_BY_DEFAULT |

## 2. Read First 证据（14 项 readiness）

### 2.1 HANDOFF_OCCURRENCE_SEMANTICS_READINESS = NOT_READY
- 无 handoff occurrence entity/semantics；`HandoffDecision`（transfer/target/keyword/reason/operator/transfer_message/trace）是 runtime RPC 响应，非 occurrence fact。
- I-89：reason 不得存为单值可覆写 conversation attribute。

### 2.2 HANDOFF_REASON_FACT_READINESS = PARTIAL
- DP-163：verified free-form source reason 可以是事实，但当前**无 verified producer contract 持久化 reason**；reason 仅存在于 runtime decision。

### 2.3 HANDOFF_REASON_TAXONOMY_READINESS = NOT_READY
- 无统一 reason taxonomy；I-86：不得从 keyword/rule/free text 发明 taxonomy。

### 2.4 HANDOFF_TARGET_SELECTOR_SEMANTICS_READINESS = PARTIAL
- target selector 字符串（"人工"/`transfer_to`）存在于 runtime/rule 语义；DP-168：selector ≠ resolved assignee。

### 2.5 HANDOFF_RESOLVED_ASSIGNEE_READINESS = NOT_READY
- 无 verified Member/operator assignee resolution；无 trusted human subject（SHEEP-066-PR2）；I-91：target 不 imply ownership holder。

### 2.6 HANDOFF_QUEUE_DIMENSION_READINESS = NOT_READY
- `conversations.list`（SHEEP-060）仅 merchant/store/platform 查询维度，无 handoff filter/ordering。
- I-92：queue query 是 merchant-scoped work selection projection，不以 Active Conversation 为 authority anchor；I-93：membership 不 imply priority/mutation authority。

### 2.7 HANDOFF_OWNERSHIP_STATE_LINK_READINESS = NOT_READY
- `HANDOFF_REQUIRED`（8-state vocabulary）无 production writer（SHEEP-070/071）；DP-167：decision/occurrence/ownership state 是不同 fact layers；I-90：runtime decision 不建立 HANDOFF_REQUIRED；I-94：state ⇎ known reason。

### 2.8 HANDOFF_CURRENTNESS_SEMANTICS_READINESS = NOT_READY
- 无 handoff fact currentness；约束 #15：Queue filter 依赖 verified HANDOFF_REQUIRED producer/currentness，不得因 vocabulary 存在直接建 filter（类比 DP-162/I-84）。

### 2.9 HANDOFF_PRODUCER_READINESS = NOT_READY
- 无 production handoff fact producer；worker `handoff.evaluate`（M9 生产评估边界）返回 runtime decision，不持久化；`transfer_to_human` builtin 为 AI 工具（free-form reason）；orchestrator TransferDecision 为 in-memory runtime。
- legacy `transfer_rules`（0001）为 rule 配置（keyword/transfer_to/transfer_message/...），handoff engine 只读加载，非 handoff fact（I-85）。

### 2.10 HANDOFF_PERSISTENCE_READINESS = NOT_READY
- 无 handoff occurrence/reason/target 持久化字段/表；约束 #19：区分 current ownership snapshot 与 handoff occurrence/history lifecycle；本轮不因该 distinction 建 event/request table。

### 2.11 HANDOFF_IPC_READINESS = NOT_READY
- 无 handoff typed IPC（desktop-ipc 42 canonical channels 无此类）；无 handler。

### 2.12 HANDOFF_DETAIL_PRESENTATION_READINESS = NOT_READY
- I-87 三态区分（无 occurrence / occurrence 但 reason 缺失 / known reason）；I-88 锚定 authorized conversation。
- I-95：`HandoffDecision.trace`（steps/detail/matched）为 internal trace，不得提升为用户可见 reason/normalized fact；I-96：reason/target facts 不进 logs/telemetry。

### 2.13 HANDOFF_QUEUE_PRESENTATION_READINESS = NOT_READY
- 无 handoff queue surface；I-92/I-93。

### 2.14 HANDOFF_IMPLEMENTATION_READINESS = NOT_READY
- 上述任一缺失 → 产品实现不可行。

## 3. Decision Package（等待 Owner）
1. **不授权** `conversation.handoff_reason`、handoff target fields、handoff event/request table、Queue ordering/filter schema 或任何 v11 migration（schema v10 保持）。
2. **不实现** handoff IPC/UI/service/queue mutation；不建 handoff producer/service/event model/queue abstraction；不把 worker/orchestrator runtime handoff decision 接成 production fact；不建 Member/Auth/Capability/ResourceScope runtime。
3. **DEFER（推荐）**：事实 foundation 依赖 verified handoff producer + occurrence semantics + reason/target fact contract（DP-163~168）+ HANDOFF_REQUIRED producer/currentness + resolved assignee identity；届时按 DP-163~168 + I-85~I-96 提交最小 prerequisite。

## 4. 边界
- 未改 schema v10；未实现 Claim/Release（SHEEP-070 DEFER）、AI/Human Ownership（SHEEP-071 DEFER）、Supervisor Takeover（SHEEP-073）、Member/Auth/Session、Composer/Send/Attachments。
- 未改已 PASS：Composer/I-27~I-30、Delivery Attempt/I-33~I-41、Timeline/Queue、Customer/Product/Order Context、Ownership 决策（DP-152~162/I-68~I-84）。
- Renderer 不接触 SQLite；未联网；reference 树未读取。
