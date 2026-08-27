# Conversation Runtime Persistence Foundation（SHEEP-060-PR1）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.1 prerequisite · 日期：2026-08-27
> 定位：SHEEP-060 前置单元（PR1）——把 `SqliteNormalizedConversationRepository` 接入 production Main runtime 既有 persistence lifecycle，并建立最小 Conversation ingestion boundary。
> 依据：DP-65~68 + I-6（Owner 决策）、SHEEP-060 BLOCKED gap（DATA_PATH_GAP-QUEUE-CONVERSATION-LIST）。
> 边界：schema v7 / migrations 0001~0007 不变；不实现 Queue UI/IPC/未读/优先级/风险/timeline/平台 ingestion/sync。

## 1. Read First 结论（既有 lifecycle 复用）

- `@fastwork/persistence` `openDatabase()` 是**共享 production persistence lifecycle**（resolveDataRoot → provision → SqliteConnection → PRAGMAs → quick_check → MigrationRunner → seed；SUPPORTED=7）。
- `createWorkerBackedMainContext` 已用它接线 feedback/job/product 仓库；`m10Sqlite.conn` 为共享生产 connection。
- **缺口**：`SqliteNormalizedConversationRepository` 未接入该 lifecycle（`DATA_PATH_GAP-QUEUE-CONVERSATION-LIST`）。

## 2. 决策落地（DP-65~68 + I-6）

| DP / I | 决策 | 落地 |
|---|---|---|
| DP-65 | CONVERSATION_REPOSITORY_SHARES_MAIN_PRODUCTION_DB_LIFECYCLE | `SqliteNormalizedConversationRepository(m10Sqlite.conn)` 复用既有 conn；**未二次 openDatabase / 未建第二 connection ownership** |
| DP-66 | PRODUCTION_PERSISTENCE_FAILURE_NEVER_FALLS_BACK_TO_MEMORY | corrupt DB → openDatabase 抛错；production composition 抛错（无 silent in-memory fallback；fail-closed 测试证明） |
| DP-67 | CONVERSATION_INGESTION_IS_A_THIN_PRODUCTION_WRITE_BOUNDARY | `conversation-ingestion.ts`：`saveNormalizedConversation` = repository.save（plain INSERT；无 upsert/merge/dedupe/reconciliation；非 Domain Service/event bus/Outbox/sync） |
| DP-68 | RUNTIME_DEPENDS_ON_REPOSITORY_PORT_PRODUCTION_COMPOSITION_BINDS_SQLITE | MainContext/bootstrap 依赖 `NormalizedConversationRepository` port；SQLite 绑定仅在 `createWorkerBackedMainContext`（production composition）；test mode 用 InMemory test double |
| I-6 | QUEUE_SCOPE_IS_ALWAYS_CONTAINED_BY_MERCHANT_BOUNDARY | isolation 测试提供底层证据（listByMerchant/listByStore 无跨 merchant 泄漏）；PR1 不实现 Queue |

## 3. 接线（exact files）

- `apps/desktop/src/main/bootstrap.ts`：`MainContext.conversations`（port）+ `BootstrapOptions.conversationRepository?` + `InMemoryNormalizedConversationRepositoryImpl`（test mode test double，仅测试用）。
- `apps/desktop/src/main/worker-runtime.ts`：`createWorkerBackedMainContext` 用 `m10Sqlite.conn` 构造 `SqliteNormalizedConversationRepository` 并注入（DP-65，共享 conn）。
- `apps/desktop/src/main/services/conversation-ingestion.ts`（新建）：薄 ingestion write boundary（DP-67）。

## 4. 验证（两层 round-trip + isolation + fail-closed）

- **持久化 durability**：fresh schema-v7 DB → ingestion 写入 → close → reopen → listByMerchant/listByStore 可读。
- **production composition**：`createWorkerBackedMainContext` 写入 → 独立同 root 连接读取命中（证明 SQLite 绑定，非 InMemory）。
- **I-6 isolation**：merchant A 两 store + merchant B 两 store；listByMerchant(A) 仅 A；listByStore(A1/A2/B1/B2) 隔离；无跨 merchant 泄漏。
- **DP-66 fail-closed**：corrupt DB → openDatabase 抛错；production composition 抛错（无 memory fallback）。
- Fixture 经真实 ingestion boundary + identity seed（merchant/store/platform_account，满足 FK）。

## 5. 边界

- 无 Queue UI / typed conversation-list IPC / Queue DTO / UI filtering contract（恢复后的 SHEEP-060）。
- 无 unread/priority/risk/AI-pending；无 message timeline；无平台 ingestion；无 sync/Outbox/cloud。
- schema v7 / migrations 不变；不补 summary/updated_at；不伪造 summary/activity ordering。
- 无 secret/credential 写入 conversation persistence；Renderer 仍不接触 SQLite；typed boundary 不倒退。
- 本单元不要求视觉证据；m6 smoke 作为 production Main composition non-regression。