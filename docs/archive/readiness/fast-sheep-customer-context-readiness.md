# Customer Context Fact-Readiness（SHEEP-067 Read First）

> **时点导航（2026-09-24）**：本文是限定任务的 Read First / Fact-Readiness 历史审查；对应 Controller 评审已 `PASS`，但通过的是审查/决策包，不表示所述产品能力已实现、事实源已就绪或获得新执行授权。正文“待 Owner PASS”与 `NOT_READY / DEFER` 保留当时原意。 当前任务状态/授权以 [PROJECT_STATE.json](../../project/PROJECT_STATE.json) 为准；验收溯源见 [对应报告](../reports/SHEEP-067-report.json)。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.3 · 日期：2026-08-29
> 定位：SHEEP-067 本轮仅执行 **Customer Context Fact-Readiness / Read First**（Owner 收紧：不授权 schema migration、不实现 Customer Context UI）。
> 结论：**NOT_READY / DEFER**——无 Conversation↔Customer relation、无 verified identity semantics、无 profile facts、无 production customer ingestion；不为 Roadmap 造 fake customer card。
> 边界：0 product code / 0 UI / 0 visual evidence；不改 schema v10；不进入 Customer Context 产品实现，不进入 SHEEP-068。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-136 | CUSTOMER_CONTEXT_RESOLUTION_STARTS_FROM_THE_AUTHORIZED_CONVERSATION（Renderer 不提供/授权 customer target；Main 从已授权 Conversation 开始解析） |
| DP-137 | KNOWN_CUSTOMER_IDENTITY_DOES_NOT_IMPLY_KNOWN_PROFILE_FACTS |
| DP-138 | CUSTOMER_CONTEXT_IS_DISTINCT_FROM_MESSAGE_RICH_PAYLOADS_AND_PRODUCT_ORDER_CONTEXT（不借本单元实现 SHEEP-068/069） |
| DP-139 | CUSTOMER_IDENTITY_IS_NOT_DEDUPLICATED_ACROSS_PLATFORM_ACCOUNTS_WITHOUT_EVIDENCE（不得按 display name/相同字符串/ambient Store 猜跨账号同一 Customer） |
| DP-140 | CUSTOMER_CONTEXT_IS_A_CONVERSATION_BOUND_FACT_PROJECTION_NOT_A_GENERAL_CRM_MODEL（不扩展 CRM tags/profile/跨店画像/customer-management framework） |
| I-46 | LEGACY_BUYER_FIELDS_DO_NOT_BECOME_CUSTOMER_FACTS_WITHOUT_VERIFIED_IDENTITY_SEMANTICS |
| I-47 | ABSENT_CONVERSATION_CUSTOMER_RELATION_MUST_NOT_BE_PRESENTED_AS_A_CUSTOMER_WITH_UNKNOWN_PROFILE |
| I-48 | CUSTOMER_CONTEXT_READS_MUST_BE_ANCHORED_TO_THE_AUTHORIZED_ACTIVE_CONVERSATION（不得从 Renderer customerId 或 ambient Queue scope 建旁路；需 stale-result guard，c1 context 不得落 c2） |
| I-49 | CUSTOMER_PERSONAL_FACTS_ARE_NOT_EMITTED_TO_LOGS_OR_TELEMETRY_BY_DEFAULT |

## 2. Read First 证据（7 项 readiness）

### 2.1 CUSTOMER_CONVERSATION_RELATION_READINESS = NOT_READY
- `normalized_conversations`（0006）**无 customer_id / buyer 关联**；Conversation↔Customer cardinality / owner / lifecycle **未知**（不预设 1:1，收紧 #3）。

### 2.2 CUSTOMER_IDENTITY_SEMANTICS_READINESS = NOT_READY / PRODUCT_DECISION_REQUIRED
- legacy `buyer`/`buyer_id`（legacy + frozen baseline `NormalizedInboundMessage`）仅**候选证据**（I-46）；external identity scope 未核验；**跨平台账号不 dedup**（DP-139）。

### 2.3 CUSTOMER_IDENTITY_FACT_READINESS = PARTIAL
- `customers` 表（0007）存在（identity-only：id/merchant/platform_account/external_ref），但 **production Main 未接线**（SqliteCustomerRepository 未注入）；唯一真实 customer 事实为身份。

### 2.4 CUSTOMER_PROFILE_FACT_READINESS = NOT_READY
- 无 profile 字段（name/avatar/level 等）；**known identity ≠ known profile**（DP-137）；不伪造缺失维度（收紧 #8）。

### 2.5 CUSTOMER_INGESTION_PRODUCER_READINESS = NOT_READY
- 无 production customer ingestion/producer；平台事件流中的 `buyer_id/buyer`（generic-platform-service / pdd-orchestrator-bridge）未持久化为 customer facts。

### 2.6 CUSTOMER_CONTEXT_PRESENTATION_READINESS = NOT_READY
- 无 facts 可呈现；呈现必须锚定 authorized active conversation（I-48）+ stale guard（c1 不落 c2）；无 relation 不呈现为 unknown-profile customer（I-47）；personal facts 不进 logs（I-49）。

### 2.7 CUSTOMER_CONTEXT_IMPLEMENTATION_READINESS = NOT_READY
- 上述 2.1/2.2/2.4/2.5 任一缺失 → 产品实现不可行；production Customer Context 不实现。

## 3. Decision Package（等待 Owner）
1. **不授权** conversation.customer_id / relation table / profile fields migration（收紧 #14）；不实现 Customer Context UI。
2. **DEFER**：Customer Context 事实 foundation 依赖真实 **production Customer ingestion + Conversation relation establishment producer**（收紧 #15：禁止先建表、无 producer）；届时再按 DP-136~140 + I-46~I-49 提交最小 prerequisite/migration proposal。
3. 缺失 profile 维度**不呈现**，不制造大量"未知"字段（收紧 #8）。

## 4. 边界
- 未改 schema v10；未实现 Customer service/card/repository abstraction（收紧 #17）；未实现 Product/Order Context（SHEEP-068/069）、Attachments/Cards、Send Pipeline / Composer Send、Unread/Priority/Risk、Outbox/sync。
- 未改已 PASS：Composer/I-27~I-30、Delivery Attempt/I-33~I-41、Timeline/Queue。
- Renderer 不接触 SQLite；未联网；未读 reference/nixiang。
