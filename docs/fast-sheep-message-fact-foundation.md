# Message Fact + Runtime Ingestion Foundation（SHEEP-063-PR1）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 prerequisite · 日期：2026-08-28
> 定位：SHEEP-063 前置单元（PR1）——建立 normalized message 的**真实生产事实契约**（actor/content/time/provenance）与 **Main runtime ingestion foundation**；Timeline 仍未实现。
> 依据：SHEEP-063 Read First = BLOCKED（DATA_FACT_GAP-MESSAGE_PATH）、Owner 批准 PR1（含 forward migration 0008_message_facts.sql 授权）、DP-83/86/87/88/90 + I-12/I-13/I-15/I-16。
> 边界：不实现 Timeline IPC/UI、Composer、Attachments、Unread、真实平台 producer、sync/Outbox；Renderer 仍不接触 SQLite。

## 1. Read First 结论（事实契约优先于存储形状，DP-83）

0008 不是机械的 `created_at/sequence/content/role` 四列。先定义事实语义，再落存储：

| 维度 | 语义 | 存储 |
|---|---|---|
| identity | internal `MessageId` 是 authoritative（I-13）；`external_ref` 保持 OPAQUE，唯一性 scope 未契约化 | `id` PK；`external_ref` 普通列（**无发明 UNIQUE**） |
| actor | 客服 Conversation actor = `customer \| agent`（DP-86）；**不等于 LLM role**；不预造 AI actor；AI-assisted generation provenance 与 actor 正交（I-15） | `actor TEXT` + CHECK |
| content | typed + extensible、text-first（DP-88）；PR1 仅 `text`；attachments/rich payload 留 SHEEP-065 | `content_kind TEXT`（CHECK text-only）+ `content_text TEXT` |
| time | `occurred_at` = source/platform occurrence time（可 unknown）；`observed_at` = Fast Sheep observed/ingested time，由 Main ingestion boundary 产生（DP-87）；**不再使用含糊 `created_at`** | 两个独立可空列 |
| source/provenance | 最小 typed facts（external_ref + occurred_at + observed_at）；**无 metadata JSON bag** | 上述列 |
| ordering | I-12：排序策略与持久化事实分离；稳定 tie-breaker；local ingestion order 不冒充 source absolute order | query 时 `ORDER BY (occurred_at IS NULL), occurred_at, id` |

## 2. 决策落地（DP-90 + I-12/I-13/I-15/I-16）

- **DP-90** `MESSAGE_REPOSITORY_SHARES_MAIN_PRODUCTION_DB_LIFECYCLE`：`SqliteMessageRepository(m10Sqlite.conn)` 复用 `createWorkerBackedMainContext` 既有生产 connection；**未二次 openDatabase / 未建第二 connection ownership**；production 失败不 silent fallback memory（DP-66）。
- **DP-86 + I-15**：actor taxonomy 最小集合（customer/agent），无 AI actor；generation provenance 正交、未建模（真实 producer 出现后再定义）。
- **DP-87**：`occurred_at`（source，可 unknown）与 `observed_at`（Fast Sheep，ingestion boundary 产生）显式区分；repository 只保存事实，不暗中制造 provenance。
- **DP-88**：content typed text-first；ingestion boundary 强制 `contentKind='text'` + `contentText` string；非 text 拒绝（fail loudly）。
- **I-16**：v7→v8 迁移对既有 fact-less `normalized_messages` 行**全部保留 NULL**（actor/content/time/provenance），无 system/空文本/migration-time 伪 backfill。
- **I-12**：确定性可解释排序；equal-time tie 按内部 id；unknown occurred_at 置后。
- **I-13**：internal/external identity 区分；external_ref 无 UNIQUE、无 dedupe 语义（真实 producer 的 dedupe/edit/recall/reconciliation/idempotency policy DEFER）。

## 3. 接线（exact files）

- `packages/persistence/migrations/0008_message_facts.sql`（新建）：`SUPPORTED_DB_SCHEMA_VERSION` 7→8；`normalized_messages` 增列 `actor/content_kind/content_text/occurred_at/observed_at`；actor/content_kind 带 CHECK。
- `packages/persistence/src/repositories/conversation-repositories.ts`：`MessageRecord` 扩展 typed 事实字段（全可选、NULL=unknown）；`MessageActor`/`MessageContentKind` 类型。
- `packages/persistence/src/sqlite/sqlite-conversation-repositories.ts`：`SqliteMessageRepository` 持久化/读取新事实列；`listByConversation` 应用 I-12 排序；未知/契约外值映射 null。
- `apps/desktop/src/main/services/message-ingestion.ts`（新建）：薄 ingestion write boundary（append/persist；无 upsert/merge/dedupe；actor+text 校验；observed_at 在此产生）。
- `apps/desktop/src/main/bootstrap.ts`：`MainContext.messages`（port）+ `BootstrapOptions.messageRepository?` + `InMemoryMessageRepositoryImpl`（test mode test double）。
- `apps/desktop/src/main/worker-runtime.ts`：production composition 用 `m10Sqlite.conn` 构造 `SqliteMessageRepository` 注入（DP-90）。
- v7→v8 传播：persistence/migrations/backup/secret-store 测试、desktop foundation 测试、M12 脚本断言同步为 8。

## 4. 验证（tests）

`apps/desktop/tests/message-fact-foundation.test.ts`（8 个 guard）：

1. fresh 0001→0008：schema v8 + 8 个 migration；`normalized_messages` 事实列存在；actor/content_kind CHECK 存在；external_ref 无 UNIQUE（I-13）。
2. v7→v8 upgrade：临时 migrations 0001~0007 → 真实目录应用 0008；backup 创建；既有 fact-less 行 5 个事实列**全部 NULL**（I-16）；0001~0007 checksum 不变。
3. ingestion boundary：typed text-first（DP-88）；actor customer/agent（DP-86/I-15）；observed_at 由 boundary 产生且 ≠ occurred_at（DP-87）；缺 actor / 非 text 拒绝；repository 直接存 unknown 行不伪造（I-16）。
4. DP-90 production composition：`createWorkerBackedMainContext` 写入 → 独立同 root 连接读取命中（cross-connection proof，SQLite 非 InMemory）。
5. close/reopen round-trip：真实 ingestion → SQLite → reopen → 事实完整。
6. I-12 排序：occurred_at 已知升序；equal-time tie 按 id；unknown 置后；插入顺序不驱动排序。
7. conversation isolation：`listByConversation(c1)` 不返回 c2 消息。
8. DP-66 fail-closed：corrupt DB → production composition 抛错（无 memory fallback）。

## 5. 边界与未实现

- 未实现 Timeline IPC/UI、Composer、Attachments（SHEEP-065）、Unread、真实平台 producer、sync/Outbox/cloud。
- `saveNormalizedMessage` 为 plain INSERT；duplicate/idempotency/external_ref reconciliation 等真实 producer ingestion 语义 DEFER。
- `UNREAD_FACT_READINESS` 输出：**PARTIALLY_READY / STILL_BLOCKED_BY_READER_PROGRESS**（不自动变 READY；reader-progress 未建立）。
- 无视觉证据要求；m6 Electron smoke = production Main composition non-regression（external_network_calls=0）。
- 未读 reference/nixiang；未联网；无 secret/credential 落库。
