# Startup Rehydration Wiring Foundation（SHEEP-074-PR1 执行记录）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.5（独立 prerequisite）· 日期：2026-08-29
> 定位：仅将 existing verified recovery capability 接入 **production startup wiring**；不建立通用 Recovery Engine，不改 schema。
> 结论：**COMPLETE（等待 Controller PASS）**——Delivery Attempt merchant-scoped startup recovery 已接入真实 production composition（`createWorkerBackedMainContext`）；Background Job recovery 按 evidence gate **明确 DEFER**；Import recovery 未接入；schema v10 不变。

## 1. 决策契约（本单元采用）

| DP / I | 决策 |
|---|---|
| DP-178 | STARTUP_REHYDRATION_RUNS_AFTER_TRUSTED_CONTEXT_ESTABLISHMENT_AND_BEFORE_AFFECTED_RUNTIME_EXPOSURE |
| I-115 | STARTUP_RECOVERY_MUST_COMPLETE_OR_FAIL_CLOSED_BEFORE_AFFECTED_STATE_IS_EXPOSED_AS_RECOVERED（complete = safe recovery/reconciliation classification 完成，不要求 resumed long-running work 本身执行结束） |
| I-116 | STARTUP_RECOVERY_STEPS_MUST_BE_IDEMPOTENT_OR_RECOVERABLY_REPEATABLE |
| I-117 | STARTUP_RECOVERY_FAILURE_MUST_FAIL_CLOSED_FOR_THE_AFFECTED_SUBSYSTEM_NOT_FABRICATE_RECOVERY_SUCCESS |
| I-118 | RECOVERY_INTEGRATION_TEST_FIXTURES_MUST_NOT_REQUIRE_FAKE_PRODUCTION_SIDE_EFFECT_ADAPTERS |
| I-119 | STARTUP_RECOVERY_SCOPE_FOLLOWS_THE_RECOVERED_STATE_OWNER_AND_MUST_NOT_INFER_SCOPE_FROM_AN_UNRELATED_WORKSPACE_FILTER |

## 2. 实现

### 2.1 新增 merchant-scoped recovery（persistence）
`packages/persistence/src/delivery/delivery-attempt.ts` 新增：

- `recoverWorkspaceInFlightDeliveryAttempts(conn, merchantId, resolvedAt)`：
  - 仅恢复 conversation→merchant == workspace merchant 的 unresolved IN_FLIGHT attempt → **UNKNOWN**（DP-128/I-33：不 REJECTED/ACK、不自动 retry、不产生 delivered fact）。
  - 其他 merchant / 无法确定 owner 的 attempt 一律 **不动**（I-119；无全库无 scope UPDATE）。
  - **idempotent**（I-116）：`resolve()` 只转换 PENDING/IN_FLIGHT；重复启动 no-op，resolvedAt 不被改写。
  - **fail-closed**（I-117）：SQL 失败直接抛出，不吞错、不伪装成功。
- 从 `packages/persistence/src/index.ts` 导出函数与 `DeliveryAttemptRecoveryResult` 类型。

### 2.2 production startup wiring（apps/desktop/src/main/worker-runtime.ts）
在 `createWorkerBackedMainContext` 中按 DP-178 顺序：DB open/migrate/validate → trusted WorkspaceMerchantContext → repositories/composition → **eligible recovery** → createMainContext（affected runtime exposure）。

- `if (workspaceMerchant) recoverWorkspaceInFlightDeliveryAttempts(m10Sqlite.conn, workspaceMerchant.merchantId, now)`。
- 无 try/catch：recovery 失败直接传播 → startup 中止 → 受影响子系统（delivery journal）不以 recovered 状态暴露（I-115/I-117）。
- 无 trusted merchant context 时（offline/test 组合）无 recovery scope → 跳过且不宣称 recovered（I-119）。
- Production composition 仍不绑定任何 fake/test `TextDeliveryPort`（DP-129）。

### 2.3 Background Job recovery = 明确 DEFER（evidence gate）
约束 #7/#8：需 production job owner、durability、idempotency、external-side-effect contract 均有直接证据才接入。现状：

- `JobRecord` **无 merchant/owner scope 字段** → owner/scope 不清（约束 #8：不接）。
- `recoverJob` 的 idempotency 为 `job.result?.includes("idempotent")` 字符串启发式，非逐 job 声明的 contract（证据不足）。
- 因此 **不接入 production startup**，明确 DEFER；不阻塞 PR1 PASS。

### 2.4 未实现
- Import `resumeSession` 不接 startup；不实现 durable ImportSessionStore（约束 #9）。
- Backup/restore 不参与 ordinary startup recovery（约束 #10；DP-177/I-112）。
- 无 active selection / draft / suggestion / AI operation persistence（约束 #11；SHEEP-075 边界保持）。
- 无 recovery timestamp/checkpoint/status/schema 字段；schema v10 不变（约束 #12）。
- 无 RecoveryRegistry/Plugin/CheckpointEngine 通用框架（约束 #13）；仅薄 wiring。
- 无 UI / visual evidence（约束 #15）。

## 3. Restart Integration Evidence（约束 #4/#6/#14 — 生产级）
测试走 **真实 production startup composition**（`createWorkerBackedMainContext`），startup #1 经真实 v10 persistence/repository 建立合法 IN_FLIGHT fixture（无 fake delivery adapter，I-118），startup #2 自动 recovery：

1. **current Merchant IN_FLIGHT → UNKNOWN**：workspace merchant 的 2 个 IN_FLIGHT attempt 在真实 startup #2 后变为 UNKNOWN（带 resolvedAt，无 delivered fact）。
2. **other Merchant IN_FLIGHT 不被修改**：merchant B 的 IN_FLIGHT attempt 保持 IN_FLIGHT（I-119）。
3. **repeated startup idempotent/no-op**：第二次 startup 后无 IN_FLIGHT 残留、resolvedAt 不重写（I-116）。
4. **recovery failure 不被吞掉**：模拟 recovery 侧失败（startup 时 `delivery_attempts` 表缺失）→ `createWorkerBackedMainContext` **抛出**，不返回声称 recovered 的 context（I-117）；函数级 closed-conn 亦抛出。
5. **scoping/counts**：merchant-scoped recovery 返回 recovered / untouched 计数，cross-merchant 不动。

新增自动化：persistence +1（89/89）、desktop +5（303/303）。

## 4. 边界与回归
- schema v10 不变；未改 Composer/Delivery Attempt/Timeline/Queue/Ownership/Handoff 既有决策。
- 回归：typecheck（20 packages）PASS；desktop-ipc 9/9 + desktop 303/303 PASS；persistence 89/89 PASS；m6 Electron smoke PASS（external_network_calls=0）；check:boundary + scan:secrets PASS。
- reference 只读树未修改；无 secrets；`next_stage_not_executed = true`（SHEEP-075 未执行）。
