# Attachment Fact-Readiness Review（SHEEP-065）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 · 日期：2026-08-28
> 定位：SHEEP-065 本轮仅执行 **Fact-Readiness Review + Contract Decision Package**（Owner 收紧：不授权 migration 00010、不批准 Attachment/Card 产品实现、无 visual evidence）。
> 结论：**evidence-aware BLOCKED/DEFERRED**——无真实 attachment 事实源/事实契约（`ATTACHMENT_FACT_CONTRACT=NOT_READY` / `ATTACHMENT_PRODUCER=NOT_READY`）；不为 Roadmap 制造 fake attachment/card UI。
> 边界：不改 schema v9；不实现 Send Pipeline / platform producer / Composer attachment staging / Outbox / sync / Product-Order Context / Unread。

## 1. 决策契约（本轮记录，待 Owner PASS；编号以 Owner 最新批准为准）

| DP / I | 决策 | 说明 |
|---|---|---|
| DP-111 | ATTACHMENT_FACT_MODEL_IS_TYPED_EXTENSIBLE_NOT_METADATA_BAG | 禁止万能 metadata JSON 替代 typed facts（legacy `metadata`/`product_context`/`order_context` Record<string,unknown> 是反例，不复制） |
| DP-112 | ATTACHMENT_STORAGE_FOLLOWS_MESSAGE_FACT_SEMANTICS | Read First 先确认 attachment owner/lifecycle/cardinality/source identity/authoritative metadata 再决定 storage；未完成前不得 00010 |
| DP-113 | TYPED_ATTACHMENT_PRESENTERS_ARE_THIN_AND_KIND_SPECIFIC | 禁止 CardRegistry/variant engine/plugin/rich-content framework |
| DP-114 | HISTORICAL_UNKNOWN_ATTACHMENTS_STAY_UNKNOWN | 不用 fake filename/MIME/type/size/thumbnail 填充未知事实；0 child rows ≠ 确定无附件（无 completeness 证据不得推断已知无附件） |
| DP-115 | ATTACHMENT_FACTS_AND_CARD_PRESENTATION_ARE_SEPARATE_CONTRACTS | 事实契约与 Card 呈现契约分离 |
| DP-116 | MESSAGE_TEXT_AND_ATTACHMENTS_ARE_ORTHOGONAL_FACTS | Message 可同时有 text + zero/many attachments；不把模型简化成 content_kind=text\|rich 互斥结构 |
| DP-117 | ATTACHMENT_SOURCE_REFERENCE_IS_NOT_RENDERER_LOAD_AUTHORITY | source URL/ref 不授权 Renderer 直接网络加载；CSP/network boundary 保持；download/materialization/cache 另立受控 pipeline |
| DP-118 | ATTACHMENT_BINARY_STORAGE_IS_NOT_PART_OF_NORMALIZED_MESSAGE_FACTS_BY_DEFAULT | 本单元不把 image/file bytes/blob 直接塞 SQLite；后续 Asset/Cache 需求另决策 |
| I-31 | MESSAGE_RICH_PAYLOADS_DO_NOT_DEFINE_PRODUCT_ORDER_CONTEXT_DOMAIN | 消息内商品/订单 payload 与 M4.3 Product/Order Context 不同语义层；不得借 Cards 提前实现 M4.3 |

## 2. Read First 证据

### 2.1 ATTACHMENT_FACT_READINESS = BLOCKED
- `normalized_messages`（0008）仅 text 事实：`content_kind CHECK('text')` + `content_text`；**无 attachment 列/表**。
- legacy `conversation_messages.type`（`text|image|video|transfer_marker|system`）+ `metadata JSON` 是 **legacy 参考**（DP-84 仅语义参考），且 metadata JSON bag 恰是 DP-111 禁止的形态。
- **message+attachment cardinality**：无证据（单/多 attachment、text+attachment 共存均未证实）。
- **source identity / locator sensitivity**：无 attachment 级 source identity；external_ref 保持 opaque；无 URL/signed-URL 契约；Renderer 目前不 fetch 远程资源（I-31 未实现，也无对应边界）。
- **legacy completeness**：无法证明历史"无附件"（I-32：0 child rows ≠ 确定无附件）。

### 2.2 ATTACHMENT_SOURCE_READINESS = BLOCKED
- 冻结基线平台消息规范化（`platform-web-common/normalize.ts`）**硬编码 `message_type: "text"`**，仅提取 `content` 文本；无 inbound image/attachment 事实抽取。
- Doudian `send_image: true` 但 `DOUDIAN_CAPABILITY_CERTAINTY.send_image = "PARTIAL"`；`image-driver` 是 **outbound DOM send 驱动**（`domSendImage(..., assetRef)`），不是 inbound attachment 事实源。
- 尚无真实平台 producer 将 normalized messages 写入 production（platform 未接入 ingestion）；Fast Sheep 自身 orchestrator/worker 无 attachment 契约。

### 2.3 ATTACHMENT_BINARY_LIFECYCLE_READINESS = NOT_READY（独立能力，DP-113）
- 无 download/cache/upload/cleanup 能力；fact 与 binary 生命周期分离，本轮不实现。

### 2.4 ATTACHMENT_PRESENTATION_READINESS = NOT_READY
- 无 attachment facts 可渲染；DP-114 thin typed rendering 在事实 foundation 获批前不可实现。

## 3. Decision Package（Owner 决策点）
1. **不授权 migration 00010**；schema v9 保持。
2. **不实现** Attachment/Card 产品 UI（Composer 不加 placeholder/disabled 附件控件；无"开发中"控件）。
3. **DEFER**：Attachment 事实 foundation 依赖未来**真实 platform-ingestion 单元**产生可证实的 attachment facts（cardinality / source identity / locator sensitivity / completeness evidence）；届时再按 DP-111~117 + I-31/I-32 提交最小 prerequisite / 00010 proposal。
4. 本轮 SHEEP-065 以 evidence-aware BLOCKED/DEFERRED 关闭（合法结论，非缺陷）。

## 4. 边界
- 未改 schema / 未实现 Send Pipeline / platform producer / Composer attachment staging / Outbox / sync / Product-Order Context / Unread / Priority / Risk。
- 未改已 PASS 的 Composer / I-27~I-30；Renderer 不接触 SQLite；未联网；未读 nixiang（仅读冻结技术基线 rebuild）。
