# Fast Sheep Conversation List（SHEEP-060，恢复后）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.1 · 日期：2026-08-27
> 定位：Conversation List（Queue，Agent primary work-entry surface）；基于 PR1 真实 production persistence path 实现。
> 依据：DP-57~64 + DP-69 + I-5/I-6/I-7（Owner 最终收紧）、PR1（persistence path）、Phase 4 entry 硬约束。

## 1. 数据路径（DP-57：TYPED_MAIN_PROJECTION_WITH_SEMANTIC_REFRESH_BOUNDARY）

```
normalized_conversations (SQLite, PR1 接入) -> Main conversations.list (merchant-constrained projection)
  -> typed IPC -> Renderer ViewModel (queueItems)
```

- Renderer 不直读 SQLite；无复杂 subscription framework（semantic refresh = initial query + scope-change re-query + 既有 refresh boundary；无 conversation-arrived 预造事件）。

## 2. 决策落地（DP-57~64 + DP-69 + I-5/6/7）

| DP / I | 落地 |
|---|---|
| DP-57 | typed `conversations.list` 查询；Main 目的化投影 |
| DP-58 | `QueueItemView = { conversation_id, store_id }`（最小事实字段；不暴露 platform_account_id，不伪造 buyer/summary/timestamp） |
| DP-59 | `QueueScope = all_stores \| specific_store`；shop-sidebar 为 PROVISIONAL scope control；scope 改变只 re-query，不清空/切换 active conversation；All Stores 完整 UI 留 SHEEP-061；无伪 `storeId="all"` |
| DP-60 | native `<button>`：Tab 移动 focus 不激活；Enter/Space/pointer 才激活 |
| DP-61 | purpose-built projection（非全量 conversation DTO） |
| DP-62 + I-7 | active identity 原子 anchor 契约；本单元只显示 queue item 自身 identity 事实（无 mixed-context） |
| DP-63 | 按 conversation_id 稳定 technical ordering（无 recency/activity/priority 语义；UI 无相关暗示文案） |
| DP-64 | 无可靠 summary source -> 不显示摘要（show less） |
| DP-69 | activation = navigation state only（不 claim/mark-read/DB/ownership/store/send） |
| I-5 | Queue 选工作，Conversation 解释工作；不退化 ERP 数据表 |
| I-6 | 查询始终 merchant-boundary（Main 解析；renderer 不传 merchant；无跨 merchant 泄漏） |
| I-7 | 显示事实与 active identity 一致（本单元仅 queue item identity） |

## 3. 接线（exact files）

- `packages/desktop-ipc`：`conversations.list` 通道 + `QueueScope/QueueItemView/ConversationListRequest/Result` 类型 + preload-api。
- `apps/desktop/src/preload`：channel allowlist + `listConversations`。
- `apps/desktop/src/main`：bootstrap（conversations/stores port + in-memory double）、worker-runtime（Sqlite conversation+store）、query-handlers（conversations.list，merchant 边界 Main 侧解析）、index.ts（registerIpc 传参）。
- `apps/desktop/src/renderer`：view-model（queue state + helpers）、workbench-store（refreshQueue/setQueueScope/activateConversation）、conversation-list 组件（SHEEP-046 states consumer）、app-shell（queue 左轨 surface，NO_UNRELATED_TOPOLOGY_REWRITE）、app.ts（sidebar → provisional scope control）。
- `apps/desktop/src/renderer/styles.css`（queue 样式）。

## 4. 验证

- store 测试：activation = navigation state（DP-69）；scope change re-query 且不清 active conversation（DP-59/5）；queue error 内联（DP-55/47）。
- query 测试：specific_store merchant-constrained + deterministic ordering（DP-63/I-6）；unknown store NOT_FOUND；all_stores 受 selected-shop merchant 边界（无跨 merchant 泄漏）；无伪 storeId="all"。
- 视觉证据：populated queue（真实 persistence→IPC→Renderer，active vs keyboard-focused）+ production-real Empty queue。
- 回归：desktop 244/244、workspace 全绿、m6 smoke `external_network_calls=0`、boundary/secrets PASS。

## 5. 边界

- 未实现 timeline/composer/send/takeover（M4.2/M4.4）、unread/priority/risk（SHEEP-062）、完整 filters（SHEEP-061）、平台 ingestion、sync/Outbox/cloud。
- 未新增 conversations.activate IPC（DP-69：activation 为 navigation state，Read First 未证明需 Main-owned）。
- schema v7 / migrations 0001~0007 不变；未伪造 summary/activity ordering（future constraint）。
- 未借本单元重排/删除既有功能区；本 queue 放置非最终 Conversation-centered Workspace layout。