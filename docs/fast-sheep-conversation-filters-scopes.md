# Fast Sheep Conversation Filters / Store / Platform Scopes（SHEEP-061）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.1 · 日期：2026-08-28
> 定位：Queue Filters / Store / Platform Scopes；topology 收敛（Queue 内嵌 scope controls，Store 不再是并行导航列）。
> 依据：DP-70~77 + I-8/I-9（Owner 收紧决策）、SHEEP-060（Queue）、Phase 4 entry 硬约束。

## 1. 决策落地（DP-70~77 + I-8/I-9）

| DP / I | 落地 |
|---|---|
| DP-70 | QUEUE_EMBEDS_SCOPE_CONTROLS_STORE_IS_NOT_A_PARALLEL_NAVIGATION_RAIL——目标 topology `Queue(scope controls + list) + Main`；移除 production composition 中独立 Store rail（shop-sidebar）；Store 转为 Queue query scope |
| DP-71 | PLATFORM_FILTER_USES_CANONICAL_PLATFORM_IDENTITY_AND_MAIN_PROJECTION——desktop-ipc 用 canonical typed union `QueuePlatformFilter`（非裸 string；一致性测试同步 Main PLATFORM_IDS）；平台过滤在 Main 经 `platform_accounts` 解析（事实源），无 schema/repo 改动 |
| DP-72 | ALL_STORES_IS_MERCHANT_SCOPED_QUEUE_QUERY——始终受 I-6 merchant boundary 约束 |
| DP-73 | FILTERS_ARE_QUERY_DIMENSIONS_NOT_CONVERSATION_FACTS |
| DP-74 | ALL_SCOPE_VALUES_ARE_QUERY_VARIANTS_NOT_DOMAIN_IDENTITIES——All Stores/All Platforms 为 query variant（无伪 StoreId/PlatformId "all"） |
| DP-75 | EXPLICIT_QUEUE_FILTERS_NO_GENERIC_FILTER_FRAMEWORK——仅 Store + Platform 两个明确维度；无 filter registry/expression/operator framework |
| DP-76 | ACTIVE_CONVERSATION_MAY_REMAIN_OUTSIDE_CURRENT_QUEUE_SCOPE_WITH_EXPLICIT_CONTEXT_CUE——calm neutral/info cue，非 error/warning；不自动切 scope/conversation |
| DP-77 | FILTER_OPTIONS_ARE_FACT_BACKED_NOT_ROADMAP_HARDCODED——Store options 来自 stores（runtime fact）；Platform options 来自 canonical capability set（Main）；无 phantom option |
| I-8 | QUEUE_FILTER_DIMENSIONS_COMPOSE_BY_INTERSECTION——final query = merchant ∩ Store Scope ∩ Platform Filter |
| I-9 | QUEUE_RESULTS_MUST_MATCH_CURRENT_QUERY_SCOPE——seq guard 防旧响应覆盖当前 scope |

## 2. 接线（exact files）

- desktop-ipc：`QueuePlatformFilter`（canonical union）、`QueueStoreOption`、`ConversationListRequest { scope, platform? }`、`Result { items, scope, platform?, stores, platforms }`。
- Main：bootstrap/worker-runtime 注入 `platformAccounts` port（SqlitePlatformAccountRepository 共享 m10Sqlite.conn）；query-handlers `conversations.list` 支持 platform filter（经 platform_accounts）+ stores/platforms options（fact-backed）。
- Renderer：view-model/store（queuePlatform、availableStores/Platforms、out-of-scope cue、I-9 seq guard）；conversation-list（原生 select scope controls + platform filter + cue）；app-shell（移除 Store rail，Queue 内嵌 controls）。

## 3. 验证

- query 测试：specific_store/all_stores × platform filter 交集（I-8）；merchant 隔离（I-6）；options fact-backed（DP-77）；canonical identity 一致性（DP-71）。
- renderer 测试：I-9 stale 保护；DP-76 out-of-scope cue 条件；platform filter 不改写 active（DP-73/59）。
- 视觉证据（真实 persistence→Main→IPC→Renderer）：All Stores+All Platforms / Specific Store / Platform filter / Active outside scope / Empty。
- 回归：desktop 251/251、workspace 全绿、m6 smoke `external_network_calls=0`、boundary/secrets PASS。

## 4. 边界

- 未实现 unread/priority/risk/AI-pending（SHEEP-062）、summary/activity、timeline/composer（M4.2）、平台 ingestion、sync/Outbox。
- schema v7 / migrations 不变；未硬编码 Roadmap 平台 taxonomy（canonical + 一致性测试）。
- Store 非并行导航列；未重排 Main/Conversation/AI/Platform；shop-sidebar 文件保留（未删除）。