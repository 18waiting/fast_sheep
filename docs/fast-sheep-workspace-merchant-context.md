# Workspace Merchant Context Foundation（SHEEP-063-PR2）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 prerequisite · 日期：2026-08-28
> 定位：SHEEP-063-PR2——建立 Main-owned `WorkspaceMerchantContext`（最小授权锚点）+ DP-98 单一 Merchant authority source；Queue/UI semantics 保持不变。
> 依据：Owner 批准 PR2 收紧（DP-94~98 + I-17~I-19）；前置 SHEEP-063-PR2-PR1（identity bootstrap，已 PASS，schema v9）。
> 边界：不实现 Timeline IPC/UI、Composer、Attachments、Unread、platform producer、sync/Outbox、auth/cloud/entitlement/session UI、multi-merchant selector。

## 1. 决策落地

| DP / I | 决策 | 落地 |
|---|---|---|
| DP-94 | WORKSPACE_MERCHANT_CONTEXT_IS_MAIN_OWNED_AND_QUEUE_SCOPE_INDEPENDENT | `createWorkspaceMerchantContext`（frozen）仅在 Main composition 构建；Store/Platform Queue Scope、selected shop、active conversation **均非** merchant authority |
| DP-95 | LOCAL_DESKTOP_RUNTIME_HAS_ONE_ACTIVE_MERCHANT_WORKSPACE_UNTIL_MULTI_MERCHANT_REQUIREMENT_EXISTS | context 只承载单一 merchantId；不锁死物理单 merchant |
| DP-96 | WORKSPACE_MERCHANT_IDENTITY_IS_EXPLICITLY_COMPOSED_NOT_INFERRED_FROM_AMBIENT_DATA | context 来自 PR2-PR1 bootstrap 的可信身份；无 first-row/count==1/selected-shop 推断 |
| DP-97 | WORKSPACE_MERCHANT_CONTEXT_IS_A_MINIMAL_AUTHORIZATION_ANCHOR_NOT_A_SESSION_FRAMEWORK | context 仅 `merchantId` + `containsMerchant`（测试断言无额外 surface） |
| DP-98 | MERCHANT_AUTHORIZATION_HAS_ONE_MAIN_OWNED_SOURCE_OF_TRUTH | `conversations.list` 迁移：all_stores 用 `workspaceMerchant.merchantId`；specific_store 先验证 `containsMerchant(store.merchantId)` 再读；Queue filter/UI semantics 不变（Store/Platform 维度与交集保持） |
| I-17 | ACTIVE_CONVERSATION_AUTHORIZATION_IS_INDEPENDENT_OF_AMBIENT_QUEUE_SCOPE | 授权只依赖 workspaceMerchant；selectedShopId 已从 QueryDeps 移除 |
| I-18 | CONVERSATION_BOUND_READS_REQUIRE_TRUSTED_WORKSPACE_MERCHANT_CONTAINMENT | `containsMerchant` 最小 capability；renderer conversationId/storeId 仅 untrusted selector |
| I-19 | WORKSPACE_MERCHANT_CONTEXT_IS_STABLE_FOR_A_MAIN_CONTEXT_LIFETIME | context frozen；reopen 同 id（测试证明）；未来 workspace switching 需另立决策 |

## 2. 实现（exact files）

- `apps/desktop/src/main/services/workspace-merchant-context.ts`（新建）：`WorkspaceMerchantContext` + `createWorkspaceMerchantContext`（frozen；空/空白 id 拒绝）。
- `apps/desktop/src/main/bootstrap.ts`：`MainContext.workspaceMerchant: WorkspaceMerchantContext | null`（替换原 `workspaceMerchantId`）；test mode 显式 synthetic context。
- `apps/desktop/src/main/worker-runtime.ts`：`createWorkspaceMerchantContext(resolveOrBootstrapWorkspaceMerchantId(...))` 注入 production composition。
- `apps/desktop/src/main/ipc/query-handlers.ts`：`QueryDeps.workspaceMerchant`（`selectedShopId` 移除）；`conversations.list` 以 workspaceMerchant 为唯一 merchant authority；无 context → fail closed（空结果）。
- `apps/desktop/src/main/index.ts`：registerIpc 注入 `workspaceMerchant`。

## 3. 验证

- `apps/desktop/tests/workspace-merchant-context.test.ts`（4 guard）：context frozen/minimal/containsMerchant exact-match；production composition 从 bootstrap 构建 + reopen 稳定；test mode synthetic；offline → null。
- `apps/desktop/tests/conversation-list-query.test.ts`（更新 + 新增）：specific_store workspace-merchant-contained（跨 merchant store B1 → NOT_FOUND，I-18/DP-98）；all_stores 由 workspace merchant 约束（B 不泄漏）；无 workspace merchant → fail closed 空结果；Store/Platform filter 交集、DP-77 options、DP-71 canonical platform 保持。
- 回归：desktop 267/267、workspace typecheck+test 全 PASS、m6 Electron smoke PASS（external_network_calls=0）、check:boundary + secret scan PASS。

## 4. REPAIR（Owner 2026-08-28）：I-25 授权缺失不得伪装为空数据

- 新增 **I-25** `MISSING_AUTHORIZATION_CONTEXT_MUST_NOT_BE_REPRESENTED_AS_EMPTY_DOMAIN_DATA`（DP-48）。
- 修复前：`workspaceMerchant == null` 时 `conversations.list` 返回普通成功空 Queue（把 authorization/unavailable 伪装成"没有会话"）。
- 修复后：无 trusted `WorkspaceMerchantContext` → 返回显式 typed failure `desktop.workspace_unavailable`（现有 `DesktopResult` error contract），**不返回成功空结果**；只有真正 authorized 且 0 rows 的查询才产生 no-work Empty。
- Renderer/Store 已能区分（复用 SHEEP-046 error vs no-work empty）：`!res.ok` → `queueError` error state；`ok + items:[]` → no-work empty state；新增下游区分测试。
- Cross-merchant specific Store 的 NOT_FOUND information-hiding 保持；Queue/UI semantics 不变；schema v9 不变。

## 5. 边界（未实现/未改动）

- 未实现 Timeline IPC/UI（SHEEP-063 恢复后）、Composer、Attachments（SHEEP-065）、Unread、真实 platform producer、sync/Outbox。
- 未实现 auth/cloud/entitlement/session UI/multi-merchant selector；未改 Queue filter/UI semantics；schema v9 不变。
- `UNREAD_FACT_READINESS` 保持 `PARTIALLY_READY / STILL_BLOCKED_BY_READER_PROGRESS`。
- 未读 reference/nixiang；未联网；无 secret/credential；Renderer 不接触 SQLite。
