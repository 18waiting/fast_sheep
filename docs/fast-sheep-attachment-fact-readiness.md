# Attachment Fact-Readiness Review（SHEEP-065）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 · 日期：2026-08-28
> 定位：SHEEP-065 本轮仅执行 **Fact-Readiness Review + Contract Decision Package**（Owner 收紧：不授权 migration 00010、不批准 Attachment/Card 产品实现、无 visual evidence）。
> 结论：**evidence-aware BLOCKED/DEFERRED**——无真实 attachment 事实源/事实契约；不为 Roadmap 制造 fake attachment/card UI。
> 边界：不改 schema v9；不实现 Send Pipeline / platform producer / Composer attachment staging / Outbox / sync / Product-Order Context / Unread。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 | 说明 |
|---|---|---|
| DP-111 | ATTACHMENT_FACT_MODEL_IS_TYPED_EXTENSIBLE_NOT_METADATA_BAG | 禁止万能 metadata JSON bag 代替事实契约（legacy `metadata`/`product_context`/`order_context` Record<string,unknown> 是反例，不复制） |
| DP-112 | MESSAGE_BODY_AND_ATTACHMENTS_ARE_ORTHOGONAL_FACTS | 不预设 content_kind=text|image|file|rich 互斥模型；text+attachment / 多 attachment / image-only 事实需求未证实前不定 storage shape |
| DP-113 | ATTACHMENT_FACT_METADATA_AND_BINARY_LIFECYCLE_ARE_SEPARATE_CAPABILITIES | attachment fact ≠ Fast Sheep 已下载/拥有 binary；不实现 download/cache/upload/cleanup |
| DP-114 | ATTACHMENT_PRESENTATION_IS_THIN_TYPED_RENDERING_NOT_A_CARD_FRAMEWORK | 不建 Card registry/slot/variant/plugin framework |
| DP-115 | ATTACHMENT_PRESENCE_AND_FACT_COMPLETENESS_MUST_BE_EXPLICIT | presence/completeness 必须显式 |
| DP-116 | MESSAGE_ATTACHMENT_CARDS_ARE_DISTINCT_FROM_DOMAIN_CONTEXT_CARDS | 不抽象 Product/Order/Customer cards（M4.3 独立） |
| DP-117 | ATTACHMENT_ACTIONS_REQUIRE_REAL_CAPABILITY_NOT_PRESENTATION_ASSUMPTION | 无真实 open/download/preview/send 能力时不展示可用动作 |
| I-31 | RENDERER_MUST_NOT_FETCH_REMOTE_ATTACHMENT_RESOURCES_DIRECTLY | 未来 preview/fetch 必须经可信 Main/Worker/adapter 边界；Renderer 不得直接使用平台远程/signed URL |
| I-32 | ABSENCE_OF_ATTACHMENT_FACTS_DOES_NOT_IMPLY_KNOWN_NO_ATTACHMENTS_WITHOUT_COMPLETENESS_EVIDENCE | 历史 0 child rows 不得自动解释为"确定无附件" |

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
