# Workspace Merchant Identity Bootstrap（SHEEP-063-PR2-PR1，Option B）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 prerequisite · 日期：2026-08-28
> 定位：SHEEP-063-PR2 前置单元——建立**可信本地 workspace merchant identity bootstrap**（`merchants` row + `app_meta.workspace_merchant_id` pointer，原子建立）；为 PR2（WorkspaceMerchantContext）提供可信身份来源。
> 依据：Owner 决策 `MAIN_OWNED_LOCAL_WORKSPACE_IDENTITY_BOOTSTRAP` + 现有 `merchants` row + `app_meta` pointer + **授权 forward migration 0009**（Option B）；DP-99~104 + I-20~I-24。
> 边界：不实现 WorkspaceMerchantContext / Timeline / auth / cloud / platform-created merchant / multi-merchant selector；schema v9。

## 1. 决策落地

| DP / I | 决策 | 落地 |
|---|---|---|
| DP-103 | MERCHANT_IDENTITY_DOES_NOT_REQUIRE_KNOWN_DISPLAY_NAME | 0009 将 `merchants.name` 放宽为可空；`name = NULL` 表示无可信 business/display-name fact，不影响 Merchant identity 有效性 |
| DP-104 | MIGRATION_0009_ONLY_RELAXES_UNEVIDENCED_MERCHANT_NAME_REQUIREMENT | 0009 仅移除 `merchants.name NOT NULL`；**未新增** display/legal/cloud/status/owner/onboarding/profile 字段 |
| DP-99 | LOCAL_WORKSPACE_MERCHANT_IDENTITY_IS_STABLE_GENERATED_IDENTITY_NOT_MAGIC_DEFAULT | `generateWorkspaceMerchantId() = "merchant-" + randomUUID()`（复用项目既有 prefix+uuid 约定）；无 `"default"` |
| DP-100 | APP_META_STORES_WORKSPACE_IDENTITY_POINTER_NOT_MERCHANT_DOMAIN_DATA | `app_meta.workspace_merchant_id` 仅指向 authoritative `merchants.id`；不塞 domain/profile/session 数据 |
| DP-101 | WORKSPACE_IDENTITY_ESTABLISHMENT_IS_ATOMIC | `bootstrapWorkspaceMerchantId` 在单事务内 INSERT merchant(name=NULL) + INSERT pointer；失败回滚（测试用 trigger 证明无 orphan） |
| I-20 | BOOTSTRAP_CREATES_ONLY_ON_UNINITIALIZED_DATA_ROOT | pointer 存在 → resolve+validate；pointer 指向缺失 merchant → fail closed（不自动 replacement） |
| I-21 | EXISTING_IDENTITY_DATA_WITHOUT_WORKSPACE_POINTER_IS_AMBIGUOUS_NOT_BOOTSTRAPPABLE | 有 merchant 行但无 pointer → fail closed（无 first-row/count==1 推断） |
| I-23 | PRESENTATION_FALLBACK_LABELS_MUST_NOT_BE_PERSISTED_AS_UNKNOWN_DOMAIN_FACTS | name 用 NULL；未来 UI 显示"本地工作区"只能作 presentation fallback，绝不反写 merchant.name |
| I-24 | UNKNOWN_OPTIONAL_IDENTITY_FACTS_USE_NULL_NOT_MAGIC_OR_EMPTY_VALUES | name=NULL；不存 `""`/`"default"`/generated ID |

## 2. 实现（exact files）

- `packages/persistence/migrations/0009_relax_merchant_name.sql`（新建）：table rebuild 使 `merchants.name` 可空；`SUPPORTED_DB_SCHEMA_VERSION` 8→9。
- `packages/persistence/src/migrations/migration-runner.ts`：迁移执行期间在事务外 `PRAGMA foreign_keys=OFF`，完成后 `ON`（标准 SQLite schema-change 流程；0009 rebuild 需要）；FK 完整性在迁移后仍强制（测试证明）。
- `packages/persistence/src/workspace/workspace-identity.ts`（新建）：`WorkspaceIdentityBootstrap` port + `SqliteWorkspaceIdentityBootstrap`（resolve/merchantExists/hasMerchantRows/bootstrap 原子）+ `generateWorkspaceMerchantId` + `resolveOrBootstrapWorkspaceMerchantId`（I-20/I-21 策略）+ `WorkspaceIdentityError`。
- `packages/persistence/src/db/errors.ts`：`ERROR_CODES.WORKSPACE_IDENTITY`。
- `packages/persistence/src/repositories/identity-repositories.ts` + sqlite：`MerchantRecord.name: string | null`（unknown 用 NULL）。
- `apps/desktop/src/main/bootstrap.ts`：`MainContext.workspaceMerchantId: string | null` + `BootstrapOptions.workspaceMerchantId?`（test mode 显式 synthetic `"merchant-test-1"`；非 test 未提供为 null）。
- `apps/desktop/src/main/worker-runtime.ts`：production composition 在 `openDatabase` 后、services/IPC ready 前调用 `resolveOrBootstrapWorkspaceMerchantId`（**不 lazy-create**），结果注入 MainContext。

## 3. 验证

`packages/persistence/tests/workspace-identity.test.ts`（9 guard）：fresh 0001→0009 / v8→v9 upgrade（既有 name 原样保留、0001~0008 checksum 不变）/ NULL-name insert / FK+reference 完整性（非法 child merchant_id 拒绝）/ fresh bootstrap（稳定生成 id、name=NULL、pointer、无 member/auth 伪造）/ 原子性（trigger 失败回滚无 orphan）/ 稳定 reopen（同 id、无重复）/ 已初始化不 silent replacement / dangling pointer fail-closed / ambiguous fail-closed。

`apps/desktop/tests/workspace-identity-bootstrap.test.ts`（3 guard）：production composition 在组合时 bootstrap（name=NULL + pointer，probe 验证）、reopen 同 id、ambiguous/dangling fail-closed。

回归：persistence 79/79、desktop 262/262、workspace typecheck+test 全 PASS、m6 Electron smoke PASS（external_network_calls=0）、M12 migration matrix（fresh/v1~v3→v9/v9 no-op/checksum/future-version/reopen）PASS、check:boundary + secret scan PASS。

## 4. 边界（未实现/未改动）

- 未实现 WorkspaceMerchantContext（PR2）、Timeline IPC/UI、auth/cloud/entitlement/session UI、platform-created merchant、multi-merchant selector。
- 未改 Queue ordering/UI semantics；未实现 unread/priority/risk/composer/attachments/producer/sync。
- `UNREAD_FACT_READINESS` 保持 `PARTIALLY_READY / STILL_BLOCKED_BY_READER_PROGRESS`。
- 未读 reference/nixiang；未联网；无 secret/credential；Renderer 不接触 SQLite。
