# Product Context Fact-Readiness（SHEEP-068 Read First）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.3 · 日期：2026-08-29
> 定位：SHEEP-068 本轮仅执行 **Product Context Fact-Readiness / Read First**（Owner 收紧：不授权 schema migration、不实现 Product Context UI）。
> 结论：**NOT_READY / DEFER**——无 Conversation↔Product relation、无 verified product/sku identity semantics、无 catalog/temporal facts、无 production product producer；不为 Roadmap 造 fake product card。
> 边界：0 product code / 0 UI / 0 visual evidence；不改 schema v10；不进入 Product Context 产品实现，不进入 SHEEP-069。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-141 | PRODUCT_CONTEXT_RESOLUTION_STARTS_FROM_THE_AUTHORIZED_CONVERSATION（Renderer 不提供/授权 Product target；Main 从已授权 Conversation 解析） |
| DP-142 | PRODUCT_AND_SKU_IDENTITIES_REMAIN_OPAQUE_AND_SCOPE_BOUND_UNTIL_PRODUCER_SEMANTICS_ARE_VERIFIED（禁止按相同 external-ref/display/ambient Store 跨 PlatformAccount dedup） |
| DP-143 | PRODUCT_CONTEXT_IS_A_CONVERSATION_BOUND_FACT_PROJECTION_NOT_A_CATALOG_MODEL（不建 PIM/catalog/variant framework） |
| DP-144 | PRODUCT_CONTEXT_IS_DISTINCT_FROM_MESSAGE_RICH_PAYLOADS_AND_ORDER_CONTEXT（不借本单元实现 SHEEP-069） |
| DP-145 | MUTABLE_PRODUCT_FACTS_REQUIRE_EXPLICIT_OBSERVATION_OR_SOURCE_TIME_SEMANTICS（price/stock/status/promotion 未来若进入须区分当前观察状态与历史 snapshot） |
| I-51 | MESSAGE_PRODUCT_REFERENCE_OR_ORDER_ITEM_DOES_NOT_IMPLICITLY_ESTABLISH_CONVERSATION_PRODUCT_CONTEXT |
| I-52 | CONVERSATION_PRODUCT_RELATION_MUST_BE_ESTABLISHED_BY_VERIFIED_PRODUCER_FACTS_NOT_PRESENTATION_INFERENCE |
| I-53 | PRODUCT_EXTERNAL_REFERENCE_AND_SKU_EXTERNAL_REFERENCE_ARE_DISTINCT_IDENTITY_DOMAINS |
| I-54 | CURRENT_PRODUCT_STATE_MUST_NOT_BE_PRESENTED_AS_MESSAGE_TIME_PRODUCT_STATE_WITHOUT_SNAPSHOT_EVIDENCE |
| I-55 | ABSENT_CONVERSATION_PRODUCT_RELATION_MUST_NOT_BE_PRESENTED_AS_AN_UNKNOWN_PRODUCT（relation 不存在 ≠ Product 已知但 catalog 缺失） |
| I-56 | PRODUCT_CONTEXT_READS_MUST_BE_ANCHORED_TO_THE_AUTHORIZED_ACTIVE_CONVERSATION（active-conversation stale-result guard） |
| I-57 | PRODUCT_BUSINESS_FACTS_ARE_NOT_EMITTED_TO_LOGS_OR_TELEMETRY_BY_DEFAULT |

## 2. Read First 证据（9 项 readiness）

### 2.1 PRODUCT_CONVERSATION_RELATION_READINESS = NOT_READY
- `normalized_conversations`（0006）无 product 关联；Conversation↔Product cardinality / owner / lifecycle **未知**（不预设 1:1）；Message-level product reference / Order-derived relation 不自动建立 conversation context（I-51/I-52）。

### 2.2 PRODUCT_IDENTITY_SEMANTICS_READINESS = NOT_READY / PLATFORM_EVIDENCE_REQUIRED
- `domain_products.external_ref` OPAQUE、无 UNIQUE；DP-142 禁止跨 PlatformAccount dedup。

### 2.3 PRODUCT_SKU_IDENTITY_SEMANTICS_READINESS = NOT_READY / PLATFORM_EVIDENCE_REQUIRED
- `skus.external_ref` OPAQUE、独立 identity domain（I-53）；sku→product 仅结构 FK，无业务语义。

### 2.4 PRODUCT_IDENTITY_FACT_READINESS = PARTIAL
- `domain_products` / `skus` 表（0007）identity-only 存在（id/merchant/platform_account/external_ref；sku→product），但 **production Main 未接线**（无 product producer/ingestion）。

### 2.5 PRODUCT_CATALOG_FACT_READINESS = NOT_READY
- 无 catalog/business 字段（price/stock/status/variant/lifecycle）；DP-143 不建 PIM/catalog/variant framework。

### 2.6 PRODUCT_CATALOG_TEMPORAL_SEMANTICS_READINESS = NOT_READY
- 无 price/stock/status 事实；DP-145/I-54：当前观察状态 vs 历史 snapshot 语义未定义。

### 2.7 PRODUCT_INGESTION_PRODUCER_READINESS = NOT_READY
- 无 production product producer/ingestion；冻结基线 renderer 中的 Product UI fragments 仅 UI/behavior evidence，不升级为 fact/schema/producer evidence（收紧 #11）。

### 2.8 PRODUCT_CONTEXT_PRESENTATION_READINESS = NOT_READY
- 无 facts 可呈现；I-55 relation 不存在 ≠ unknown product；I-56 锚定 authorized active conversation + stale guard；I-57 business facts 不进 logs；media source refs 不获 Renderer remote-load authority（收紧 #15）。

### 2.9 PRODUCT_CONTEXT_IMPLEMENTATION_READINESS = NOT_READY
- 上述任一缺失 → 产品实现不可行。

## 3. Decision Package（等待 Owner）
1. **不授权** `conversation.product_id` / relation table / `domain_products` catalog fields / 其它 v11 migration（schema v10 保持）。
2. **不实现** Product Context UI / service / card / catalog abstraction（0 code、0 UI、0 visual）。
3. **DEFER（推荐）**：事实 foundation 依赖真实 **production Product producer + Conversation relation establishment path**（收紧 #17：禁止只有 schema/repository 无 producer）；届时按 DP-141~145 + I-51~I-57 提交最小 prerequisite/migration proposal。

## 4. 边界
- 未改 schema v10；未实现 Order/Logistics Context（SHEEP-069）、Customer Context（DEFER）、Attachments/Cards、Send Pipeline / Composer Send、Unread/Priority/Risk、Outbox/sync。
- 未改已 PASS：Composer/I-27~I-30、Delivery Attempt/I-33~I-41、Timeline/Queue、Customer Context（DP-136~140/I-46~I-50）。
- Renderer 不接触 SQLite；未联网；未读 reference/nixiang。
