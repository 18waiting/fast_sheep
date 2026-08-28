# Message Timeline（SHEEP-063）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 · 日期：2026-08-28
> 定位：SHEEP-063——在真实 Message Fact path（PR1）+ Main-owned Workspace Merchant authorization path（PR2/PR2-PR1）上实施 **Message Timeline**，成为 Conversation Main 的主要内容 surface。
> 依据：DP-84/85/89/91/92/93 + I-14/I-17/I-18/I-19（Owner 批准）；前置 PR1 / PR2-PR1 / PR2 全 PASS；schema v9 不变。
> 边界：不实现 Composer、Attachments（SHEEP-065）、Unread、真实平台 producer、sync/Outbox、auth/cloud/session/multi-merchant selector、最终 Workspace redesign。

## 1. 决策落地

| DP / I | 决策 | 落地 |
|---|---|---|
| DP-84 | TIMELINE_READS_FROM_NORMALIZED_PRODUCTION_MESSAGE_FACTS | `conversations.listMessages` 只读 `normalized_messages`（`SqliteMessageRepository`，共享 `m10Sqlite.conn`）；legacy in-memory 仅语义参考 |
| DP-85 | TIMELINE_IS_BOUND_TO_ACTIVE_CONVERSATION_ONLY | Timeline 绑定 `activeConversationId`；`timelineConversationId` 与 active 不一致时显示 loading，绝不显示旧会话 facts |
| DP-89 | TIMELINE_CONTENT_PRESERVATION_IS_ALLOWED_ONLY_WITHIN_THE_SAME_ACTIVE_CONVERSATION | 同会话 refresh 保留 last-known content（`setTimelineLoading` keep）；active 切换先 `clearTimeline`（I-7 联合） |
| DP-91 | TIMELINE_QUERY_AUTHORIZES_CONVERSATION_BEFORE_READING_MESSAGES | Main resolve Conversation 后先 `workspaceMerchant.containsMerchant(conv.merchantId)` 再读 messages；跨 merchant → NOT_FOUND（information-hiding）；无 context → `desktop.workspace_unavailable`（I-25） |
| DP-92 | INCOMPLETE_HISTORICAL_MESSAGE_FACTS_ARE_NOT_PRESENTED_AS_NORMAL_MESSAGES | presentability rule：actor+content 均已知才作正常消息行；否则 `--unknown` 行 + `（消息内容未知）`（I-16） |
| DP-93 | MESSAGE_TIME_DISPLAY_IS_PRESENTATION_OVER_EXPLICIT_TIME_FACTS | `occurred_at` 仅格式化展示；unknown 显示 `时间未知`；不用 `observed_at` 冒充 |
| I-14 | TIMELINE_RESULTS_MUST_MATCH_CURRENT_ACTIVE_CONVERSATION | store `timelineRequestSeq` stale guard：旧 response 不覆盖当前 active（测试证明） |
| I-17 | ACTIVE_CONVERSATION_AUTHORIZATION_IS_INDEPENDENT_OF_AMBIENT_QUEUE_SCOPE | 授权仅依赖 `workspaceMerchant`（PR2） |
| I-18 | CONVERSATION_BOUND_READS_REQUIRE_TRUSTED_WORKSPACE_MERCHANT_CONTAINMENT | `containsMerchant` 最小 capability（PR2） |

## 2. 实现（exact files）

- `packages/desktop-ipc`：`IPC.conversationsListMessages` + `TimelineMessageView`（purpose-built：`message_id/actor/content_kind/content_text/occurred_at`，**不暴露 observed_at/external_ref**）+ `ConversationTimelineRequest/Result` + preload surface。
- `apps/desktop/src/main/ipc/query-handlers.ts`：`[conversations.listMessages]` handler（DP-91/I-18 授权 → DP-84 读取 → I-12 排序来自 repo → purpose-built 映射）。
- `apps/desktop/src/preload/index.ts` + `api.ts`：`listConversationMessages` typed 通道。
- `apps/desktop/src/renderer/state/view-model.ts`：timeline 状态（`timelineConversationId/timelineMessages/timelineLoading/timelineError`）+ pure reducers（`setTimelineLoading` 保留同会话内容 / `setTimelineItems` / `setTimelineError` / `clearTimeline`）。
- `apps/desktop/src/renderer/state/workbench-store.ts`：`refreshTimeline`（I-14 seq guard）+ `activateConversation`（切换先清空再加载，DP-89/I-7）。
- `apps/desktop/src/renderer/components/message-timeline.ts`（新建）：Conversation Main 主内容 surface；textContent only；presentability rule（DP-92）；时间展示（DP-93）。
- `apps/desktop/src/renderer/components/app-shell.ts`：conversation-host 内渲染 timeline（Phase-4 incremental convergence，未做最终 redesign）。
- `apps/desktop/src/renderer/styles.css`：timeline 样式（calm/professional，无 chat skin/avatar）。

## 3. 验证

- `apps/desktop/tests/timeline-query.test.ts`（5 guard）：I-12 排序 + purpose-built view（无 observed_at）、unknown/NOT_FOUND、cross-merchant NOT_FOUND、no context → workspace_unavailable（非空成功）、authorized 0-row → legitimate empty、missing id → INVALID_REQUEST。
- `apps/desktop/tests/renderer-timeline.test.ts`（6 guard）：绑定 active（DP-85）、I-14 stale guard、I-7/DP-89 切换清空、I-25 unavailable=error 非 empty、authorized 0-row empty、组件 textContent/无 observed_at/DP-92/DP-93。
- 回归：desktop 280/280、workspace typecheck+test 全 PASS、m6 Electron smoke PASS（external_network_calls=0）、check:boundary + secret scan PASS。
- **Visual evidence**（真实 persistence/ingestion→Main→typed IPC→Renderer）：`sheep-063-timeline-populated.png`（含 customer/agent + 时间未知 + incomplete historical）、`sheep-063-timeline-empty.png`（production-real no-work empty）、`sheep-063-timeline-switch.png`（active 切换后旧 facts 无残留）。

## 4. REPAIR（Owner 2026-08-28）：Active Conversation presentation consistency（I-7 具体化 / 新增 I-26）

- **I-26** `WORKSPACE_ACTIVE_CONVERSATION_PRESENTATION_MUST_NOT_FALL_BACK_TO_AMBIENT_SCOPE_FACTS`（I-7 具体化）：active conversation 存在时，Workspace header / conversation panel 必须反映 authoritative active identity；Store/Platform 等 header facts 仅来自 active Conversation 的可信 projection（active queue item 的 store_id、匹配 active identity 的 viewModel.conversation），**不得从 Queue Scope / selected shop / 其它 ambient state 回填**；事实不可用时省略或明确 未知。
- 修复：新增 `activeConversationPresentation(state)` 纯 helper（identity anchor + store_id from active queue item + state/buyer only when viewModel.conversation matches）；`workbench-header.ts` / `conversation-panel.ts` 重构为 active 分支（`当前会话: <id>`）与 no-active 分支（`activeConversationId == null` 才显示 无会话/暂无活动会话）。
- 不变量：header 与 Timeline 始终同一 active identity（无 header=c1/timeline=c2 mixed context）；Queue Store/Platform Scope 改变不改写 active header identity。
- 测试（5 guard）：active exists != no-conversation；c1→c2 header/timeline 一致；scope-change 不改 active header；no-active 仅 activeConversationId==null；组件使用 helper 且 no-conversation copy 以 active===null 为门。
- Visual evidence（重捕获，最小两张）：`sheep-063-timeline-populated.png` / `sheep-063-timeline-empty.png`（header 显示 active 会话 identity）。

## 5. 边界（未实现/未改动）

- 未实现 Composer、Attachments（SHEEP-065）、Unread、Priority、Risk、真实平台 producer、sync/Outbox、auth/cloud/session/multi-merchant selector、最终 Conversation-centered Workspace redesign。
- `UNREAD_FACT_READINESS = PARTIALLY_READY / STILL_BLOCKED_BY_READER_PROGRESS`（不变；未实现 unread boolean/count）。
- Queue ordering/UI semantics 不变；schema v9 不变；Renderer 不接触 SQLite；未联网；无 secret/credential。
- 未读 reference/nixiang。
