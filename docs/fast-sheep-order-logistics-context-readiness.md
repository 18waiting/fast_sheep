# Order / Logistics Context Fact-Readiness（SHEEP-069 Read First）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.3 · 日期：2026-08-29
> 定位：SHEEP-069 本轮仅执行 **Order / Logistics Context Fact-Readiness / Read First**（Owner 收紧：不授权 schema migration、不实现 Order/Logistics Context UI）。
> 结论：**NOT_READY / DEFER**——无 Conversation↔Order / Order↔Logistics verified relation、无 verified order/logistics identity semantics、无 business/temporal facts、无 production producer；不为 Roadmap 造 fake order card。
> 边界：0 product code / 0 UI / 0 visual evidence；不改 schema v10；不进入 Order/Logistics Context 产品实现，不进入下一 SHEEP。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-146 | ORDER_LOGISTICS_CONTEXT_RESOLUTION_STARTS_FROM_THE_AUTHORIZED_CONVERSATION（Renderer 不提供/授权 Order target；Main 从已授权 Conversation 解析） |
| DP-147 | ORDER_AND_LOGISTICS_IDENTITIES_REMAIN_OPAQUE_AND_SCOPE_BOUND_UNTIL_PRODUCER_SEMANTICS_ARE_VERIFIED（禁止按相同 order_no/tracking_no/display 跨 PlatformAccount dedup） |
| DP-148 | ORDER_LOGISTICS_CONTEXT_IS_A_CONVERSATION_BOUND_FACT_PROJECTION_NOT_AN_ORDER_MANAGEMENT_MODEL（不扩展 OMS/WMS/refund/fulfillment framework） |
| DP-149 | ORDER_LOGISTICS_CONTEXT_IS_DISTINCT_FROM_MESSAGE_RICH_PAYLOADS_AND_PRODUCT_CONTEXT（Order item 不自动建立 Conversation Product Context） |
| DP-150 | MUTABLE_ORDER_LOGISTICS_FACTS_REQUIRE_EXPLICIT_OBSERVATION_OR_SOURCE_TIME_SEMANTICS（current status 不得冒充历史消息时点状态） |
| DP-151 | ORDER_AND_LOGISTICS_RELATIONS_ARE_SEPARATE_VERIFIED_FACTS（Conversation→Order 成立不自动证明 Order→Logistics；tracking/logistics reference 不自动反推 Order relation） |
| I-58 | MESSAGE_ORDER_OR_LOGISTICS_REFERENCE_DOES_NOT_IMPLICITLY_ESTABLISH_CONVERSATION_ORDER_LOGISTICS_CONTEXT |
| I-59 | CONVERSATION_ORDER_RELATION_MUST_BE_ESTABLISHED_BY_VERIFIED_PRODUCER_FACTS_NOT_PRESENTATION_INFERENCE |
| I-60 | ORDER_EXTERNAL_REFERENCE_AND_LOGISTICS_EXTERNAL_REFERENCE_ARE_DISTINCT_IDENTITY_DOMAINS |
| I-61 | ABSENT_CONVERSATION_ORDER_RELATION_MUST_NOT_BE_PRESENTED_AS_AN_UNKNOWN_ORDER（relation 不存在 ≠ Order 已知但 facts 缺失） |
| I-62 | ORDER_LOGISTICS_CONTEXT_READS_MUST_BE_ANCHORED_TO_THE_AUTHORIZED_ACTIVE_CONVERSATION（active-conversation stale-result guard） |
| I-63 | ORDER_LOGISTICS_BUSINESS_FACTS_ARE_NOT_EMITTED_TO_LOGS_OR_TELEMETRY_BY_DEFAULT |
| I-64 | MULTIPLE_RELATED_ORDERS_MUST_NOT_BE_COLLAPSED_TO_AN_IMPLICIT_CURRENT_ORDER_WITHOUT_VERIFIED_SELECTION_AUTHORITY |
| I-65 | TRACKING_REFERENCE_IS_NOT_LOGISTICS_IDENTITY_WITHOUT_VERIFIED_PLATFORM_SEMANTICS |
| I-66 | CURRENT_LOGISTICS_STATE_MUST_NOT_BE_EXPANDED_INTO_SYNTHETIC_TRACKING_EVENT_HISTORY |

约束 #14：不提前建立统一 Order/Logistics status taxonomy；只有真实平台 semantics 足够明确后才能提出 typed normalization。

## 2. Read First 证据（11 项 readiness）

### 2.1 ORDER_CONVERSATION_RELATION_READINESS = NOT_READY
- `normalized_conversations`（0006）无 order 关联；Conversation↔Order cardinality / owner / lifecycle **未知**（不预设 1:1）。
- 无 verified producer 建立 relation（I-59）；Message-level order/logistics reference 不自动建立 context（I-58）。
- 多关联订单不得折叠为隐式 current order（I-64，无 verified selection authority）。

### 2.2 ORDER_LOGISTICS_RELATION_READINESS = NOT_READY
- `logistics.order_id` FK 仅结构性；Order↔Logistics 是**独立 verified facts**（DP-151）。
- Conversation→Order 成立不自动证明 Order→Logistics；tracking/logistics reference 不自动反推 Order relation（I-58/I-65）。

### 2.3 ORDER_IDENTITY_SEMANTICS_READINESS = NOT_READY / PLATFORM_EVIDENCE_REQUIRED
- `orders.external_ref` OPAQUE TEXT、无 UNIQUE；order_no 的 scope/stability/lifecycle 未经验证。
- DP-147 禁止跨 PlatformAccount dedup；identity semantics 必须由 platform evidence 证明，不以产品决策替代。

### 2.4 LOGISTICS_IDENTITY_SEMANTICS_READINESS = NOT_READY / PLATFORM_EVIDENCE_REQUIRED
- `logistics.external_ref` OPAQUE；tracking_no ≠ logistics identity（I-65）。
- Order external ref 与 Logistics external ref 是不同 identity domains（I-60）。

### 2.5 ORDER_IDENTITY_FACT_READINESS = PARTIAL
- `orders` 表（0007）identity-only（id/merchant/platform_account/external_ref）存在；`SqliteOrderRepository` 有 persistence 层测试。
- **production Main 未接线**：bootstrap 组合根不返回 commerce repos；无 order/logistics typed IPC。

### 2.6 ORDER_BUSINESS_FACT_READINESS = NOT_READY
- 无 order business 字段（金额/status/pay-time/items）；无统一 status taxonomy（约束 #14）。
- DP-148 不建 OMS/WMS/refund/fulfillment framework。
- legacy `conversation_messages.order_context` JSON 是 message-level opaque rich payload，不是 order business facts（DP-149）。

### 2.7 LOGISTICS_FACT_READINESS = NOT_READY
- `logistics` identity-only（id/order_id/external_ref）；无 carrier/tracking events/status/times。
- I-66：不得从当前物流状态展开合成 tracking event history。

### 2.8 ORDER_LOGISTICS_TEMPORAL_SEMANTICS_READINESS = NOT_READY
- DP-150：current status 不得冒充历史消息时点状态；无 observation/source time semantics；无 snapshot 证据（类比 I-54）。

### 2.9 ORDER_LOGISTICS_INGESTION_PRODUCER_READINESS = NOT_READY
- 无 production Order/Logistics producer/ingestion。
- 生产 normalized message ingestion 边界只接受 actor + typed text（message-ingestion.ts），不承载 order/logistics payload。
- legacy PDD DOM reader 读取 `order.context` block → `conversation_messages.order_context` JSON 仅为 UI-derived opaque 快照，不是 verified order producer（DP-149/I-58）。
- platform capability flags（`order_context: true/PARTIAL/UNKNOWN`）属 **Platform Technical Capability** 声明（DP-131 先例），不等于 fact producer。

### 2.10 ORDER_LOGISTICS_CONTEXT_PRESENTATION_READINESS = NOT_READY
- 无 facts 可呈现；I-61 relation 不存在 ≠ unknown order；I-62 锚定 authorized active conversation + stale guard；I-63 business facts 不进 logs/telemetry。
- Reference renderer（sidebar.js 等）Order/Logistics UI fragments 仅 UI/behavior evidence，不升级为 schema/domain/producer evidence（约束 #16）。

### 2.11 ORDER_LOGISTICS_CONTEXT_IMPLEMENTATION_READINESS = NOT_READY
- 上述任一缺失 → 产品实现不可行。

## 3. Decision Package（等待 Owner）
1. **不授权** `conversation.order_id` / relation/event table / Order/Logistics business fields / 其它 v11 migration（schema v10 保持）。
2. **不实现** Order/Logistics Context UI / service / card / OMS/WMS abstraction；不接线 `orders`/`logistics` repos 为 readiness（0 code、0 UI、0 visual）。
3. **DEFER（推荐）**：事实 foundation 依赖真实 **production Order/Logistics producer + verified Conversation→Order 与 Order→Logistics relation path**（约束 #18：禁止只有表/repository 没 producer）；届时按 DP-146~151 + I-58~I-66 提交最小 prerequisite/migration proposal。

## 4. 边界
- 未改 schema v10；未实现 Customer/Product Context（DEFER）、Attachments/Cards、Send Pipeline / Composer Send、Unread/Priority/Risk、Outbox/sync。
- 未改已 PASS：Composer/I-27~I-30、Delivery Attempt/I-33~I-41、Timeline/Queue、Customer Context（DP-136~140/I-46~I-50）、Product Context（DP-141~145/I-51~I-57）。
- Renderer 不接触 SQLite；未联网；reference 树仅只读核验 UI fragment 存在性。
