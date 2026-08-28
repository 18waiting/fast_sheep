# Composer（SHEEP-064）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 · 日期：2026-08-28
> 定位：SHEEP-064——在 Conversation Main（active Conversation）内建立 **Composer**（manual professional fallback reply input），成为 Timeline 下方的主要回复 surface；Send 为 **explicit submit-intent contract**（Option C），执行属 SHEEP-066。
> 依据：DP-105~110 + I-27~I-29（Owner 批准 Option C）；前置 M4.2 Timeline（SHEEP-063）PASS。
> 边界：不实现 Send Pipeline / platform delivery / Outbox / sync、Attachments（SHEEP-065）、draft persistence（SHEEP-075）、Unread/Priority/Risk、Customer/Product/Order（M4.3）、schema 变更。

## 1. 决策落地

| DP / I | 决策 | 落地 |
|---|---|---|
| DP-105 | COMPOSER_IS_THE_MANUAL_PROFESSIONAL_FALLBACK_REPLY_INPUT | Composer 不依赖 AI；AI failure/HUMAN_ONLY 下仍可正常编辑（手动 draft 独立于 suggestion） |
| DP-106 | AI_SUGGESTION_APPLICATION_TO_COMPOSER_IS_EXPLICIT_AND_NON_DESTRUCTIVE | 无异步自动覆盖；用户明确"使用建议"才进入；非空 draft 不被静默 replace（`applySuggestionToComposer`：空/相同才填，否则保留 + calm note） |
| DP-107 | COMPOSER_SUBMIT_IS_EXPLICIT_INTENT_SEND_PIPELINE_OWNS_EXECUTION | 064 只定义/capture submit intent（`captureComposerSubmitIntent`）；不写 normalized outbound message、不设 occurred_at、不 delivery（I-27） |
| DP-108 | COMPOSER_DRAFT_IS_BOUND_TO_CONVERSATION_IDENTITY | draft 以 conversationId 为 key（`composerDrafts`），非 Queue row/Store Scope |
| DP-109 | EPHEMERAL_DRAFTS_SURVIVE_CONVERSATION_SWITCHES_WITHIN_THE_MAIN_CONTEXT | c1→c2→c1 保留 c1 draft；restart 可消失；持久化留 SHEEP-075 |
| DP-110 | COMPOSER_SUBMIT_CAPTURES_CONVERSATION_IDENTITY_AND_DRAFT_AT_INTENT_TIME | `captureComposerSubmitIntent(conversationId, draft)` 原子捕获；后续 active 切换不改 intent target |
| I-27 | SEND_INTENT_MUST_NOT_BE_PERSISTED_AS_DELIVERED_CONVERSATION_MESSAGE_FACT | submit 不持久化/不写 message fact（测试断言 draft 不被清除/写入） |
| I-28 | SEND_RESULT_MAY_MUTATE_ONLY_THE_DRAFT_FOR_ITS_CAPTURED_CONVERSATION | `applyComposerSendResult`：sent 清该会话 draft；failed 保留；c1 result 不清 c2（SHEEP-066 硬约束） |
| I-29 | IME_COMPOSITION_MUST_NEVER_TRIGGER_COMPOSER_SUBMIT | `shouldSubmitComposerOnEnter`：仅非 composing 且非 Shift 才 submit；Shift+Enter 换行；中文 IME composition 测试 |

## 2. 实现（exact files）

- `apps/desktop/src/renderer/state/view-model.ts`：`composerDrafts`（Record<conversationId,text>）+ `composerSendAvailable` + `composerNote`；reducers（`setComposerDraft`/`applySuggestionToComposer`/`setComposerSendAvailable`）；intent contract（`ComposerSubmitIntent`/`captureComposerSubmitIntent`/`applyComposerSendResult`/`shouldSubmitComposerOnEnter`）。
- `apps/desktop/src/renderer/state/workbench-store.ts`：`updateComposerDraft`（active conversation）、`applySuggestion`（显式非破坏）、`submitComposer`（DP-107：intent contract；无 Send capability → 诚实 unavailable，不伪造成功）。
- `apps/desktop/src/renderer/components/composer.ts`（新建）：native textarea + label（accessible name，非 placeholder-only）+ native button；Enter 仅非 IME 才 submit（I-29）；Send 在 `!composerSendAvailable` 时 native disabled + "发送功能暂不可用"；textContent only。
- `apps/desktop/src/renderer/components/app-shell.ts`：Composer 渲染在 Timeline 下方（Conversation Main 主回复 surface，非独立 sibling card）。
- `apps/desktop/src/renderer/components/suggestion-panel.ts`：新增"使用建议"显式 apply（DP-106）。
- `apps/desktop/src/renderer/components/actions.ts` + `app.ts`：composer actions 接线。
- `apps/desktop/src/renderer/styles.css`：composer 样式（calm/professional；focus-visible）。

## 3. 验证

- `apps/desktop/tests/renderer-composer.test.ts`（9 guard）：DP-105 手动 draft 独立于 AI；DP-106 显式非破坏 apply（无异步自动覆盖/空 draft 填充/非空保留+note）；DP-107/I-27 submit 只 capture intent（unavailable 诚实表达、无 delivered fact）；DP-108 draft 按 conversationId key；DP-109 c1→c2→c1 保留；DP-110 原子捕获 + target 不变；I-28 sent/failed 只影响自身会话 draft；I-29 IME/Shift+Enter/Enter；a11y native textarea/button + label + 无 innerHTML。
- 回归：desktop 294/294、workspace typecheck+test 全 PASS、m6 Electron smoke PASS（external_network_calls=0）、check:boundary + secret scan PASS。
- **Visual evidence**（真实路径）：`sheep-064-composer-empty.png`、`-draft.png`、`-apply.png`（显式使用建议 → 草稿）、`-switch.png`（c1→c2→c1 草稿保留）、`-unavailable.png`（有草稿但 Send 因 pipeline 未接入而 disabled + cue）。

## 4. 边界（未实现/未改动）

- 未实现真正 send IPC / message ingestion / platform delivery / Outbox / sync（SHEEP-066）；Attachments（SHEEP-065）；draft persistence（SHEEP-075）；Unread/Priority/Risk；Customer/Product/Order（M4.3）；schema（v9 不变）；AI 自动发送。
- 未用 `orchestrator.manual_send` 作为 Composer 临时替代（Option B 禁止）。
- Queue/UI semantics 不变；Renderer 不接触 SQLite；未联网；无 secret/credential；未读 reference/nixiang。
- `UNREAD_FACT_READINESS = PARTIALLY_READY / STILL_BLOCKED_BY_READER_PROGRESS`（不变）。
