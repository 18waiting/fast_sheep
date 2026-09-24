# Message Timeline Read First（SHEEP-063，Read First only）

> **历史 Read First 快照，非当前阻断状态**：下文的 `BLOCKED` 是 SHEEP-063 当时的 message fact 缺口；后续 [SHEEP-063-PR1](fast-sheep-message-fact-foundation.md) 已建立事实契约，且 [SHEEP-063 Timeline](fast-sheep-message-timeline.md) 在状态账本中为 `PASS / CLOSED`。原审计正文保留；当前任务状态与授权只看 [PROJECT_STATE.json](../project/PROJECT_STATE.json)。这不表示真实平台消息生产者或 SHEEP-305 的后续工作已获授权。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 · 日期：2026-08-28
> 定位：**Read First / 决策单元**（message production fact path 未证充分前不实现 Timeline）。
> 依据：DP-83~89 + I-12~I-14（Owner 收紧决策）、SHEEP-062 disposition（UNREAD=DEFER_TO_M4_2_MESSAGE_FACTS）、Phase 4 硬约束、R-07。

## 1. Read First 核验（现有 message 事实契约）

| 契约 | 现有事实 | 对 Timeline 的结论 |
|---|---|---|
| `normalized_messages`（Sqlite） | id / conversation_id / external_ref；**无 content / actor / time / ordering（仅 id）/ source-provenance** | **存储缺核心事实** |
| `MessageRepository`（normalized） | save / findById / listByConversation（仅 id/conversation/external_ref） | 无 timeline 事实查询 |
| Message ingestion | 仅 Conversation ingestion（PR1）；**无 message ingestion boundary** | **缺 producer 写入入口** |
| Main composition | SqliteMessageRepository **未接入** Main 既有 lifecycle | 无消息投影/组合 |
| Legacy `ConversationRepository.MessageRecord`（orchestrator in-memory） | content / role / created_at / type / buyer / platform / context | **仅语义参考（DP-84：非 production Timeline source）** |
| Actor 语义 | legacy `role`（user/assistant/system = LLM roles） | **DP-86：不得直接当客服 Conversation actor model** |
| Time 语义 | legacy `created_at` 含糊（未区分 source occurrence vs observed/ingested） | **DP-87：需显式语义** |
| Ordering | normalized ORDER BY id（technical）；平台绝对顺序未建模 | **I-12：需确定性可解释排序 + 稳定 tie-breaker** |
| Identity | internal `id` + opaque `external_ref`（字段区分 ✓；external_ref 唯一性/范围未契约化） | **I-13：保持 distinct；外部 identity 范围需核验** |

## 2. 结论：message production fact path **不充分（BLOCKED）**

- **storage / repository / composition / ingestion / actor / content / time / ordering 任一核心能力缺失**（收紧 #11 判定触发）。
- 不实现 Timeline；不伪造；不改 schema。

## 3. 决策包（DP-83~89 + I-12~I-14）

- DP-83 MESSAGE_FACT_CONTRACT_PRECEDES_STORAGE_SHAPE：先明确 identity/actor/content/time/ordering/source-provenance 语义，再决定 storage（不预设 migration 0008 四列）。
- DP-84 TIMELINE_READS_FROM_NORMALIZED_PRODUCTION_MESSAGE_FACTS：legacy in-memory 仅语义参考。
- DP-85 TIMELINE_IS_BOUND_TO_ACTIVE_CONVERSATION_ONLY：ambient Store/Platform Queue Scope 不改写 Timeline identity。
- DP-86 CONVERSATION_MESSAGE_ACTOR_SEMANTICS_ARE_DISTINCT_FROM_LLM_ROLES：AI suggestion provenance 与实际 outbound actor 可区分。
- DP-87 MESSAGE_TIME_SEMANTICS_MUST_BE_EXPLICIT：区分 source/platform occurrence time 与 Fast Sheep observed/ingested time。
- DP-88 MESSAGE_CONTENT_IS_TYPED_EXTENSIBLE_TEXT_FIRST_NOT_TEXT_ONLY：063 可只实现 text，但 contract 不锁死纯字符串（attachments 留 SHEEP-065）。
- DP-89 TIMELINE_CONTENT_PRESERVATION_WITHIN_SAME_ACTIVE_CONVERSATION：refresh 可按 DP-45 保留同会话 last-known content；active 切换不冒充。
- I-12 MESSAGE_TIMELINE_ORDERING_IS_DETERMINISTIC_AND_EXPLAINABLE。
- I-13 INTERNAL_MESSAGE_IDENTITY_AND_EXTERNAL_SOURCE_IDENTITY_REMAIN_DISTINCT。
- I-14 TIMELINE_RESULTS_MUST_MATCH_CURRENT_ACTIVE_CONVERSATION（stale-result protection，未来实现）。

## 4. 下一步（收紧 #11）

提交 **SHEEP-063-PR1 — Message Fact + Runtime Ingestion Foundation** proposal（最小 prerequisite；不把 migration + ingestion + IPC + Timeline UI 一次性塞进 063）；未经 Owner PASS 不执行 PR1；不进入 Timeline 实现。

## 5. UNREAD_FACT_READINESS（收紧 #16 重输出）

**仍非 ready**：reader-progress 尚未建立（message facts 未建）；不显示 unread。

## 6. 边界

- 未实现 Timeline/indicator；未改 schema/migrations（v7 不变）；未改 Queue ordering；未读 reference/nixiang；未联网。