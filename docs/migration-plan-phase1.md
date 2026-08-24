# Phase 1 Domain Migration Plan (SHEEP-018)

> 项目：Fast Sheep / 快羊客服 · 阶段：Phase 1 M1.4 Persistence Evolution
> 状态：PLAN（规划文档，非实现）· 日期：2026-08-24
> 范围：仅规划 + 审计。**不写 migration SQL、不实现 repository、不改任何数据**（实施 = SHEEP-019，兼容 smoke = SHEEP-020）。

## 1. 目的

为 Phase 1 已确认的领域模型（SHEEP-010~017）制定**只新增、不修改历史**的 forward migration 规划，
使未来落库可审计、可回滚、可验证，并为 M1.5 Sync-Ready Persistence Contract 预留可加性。

## 2. 治理依据

- Roadmap M1.4 SHEEP-018：只新增 migration，不修改历史 migration。
- Master §5.4：数据模型逐步引入 merchant_id / store_id / platform_account_id / member-seat scope + sync/version metadata；不"大爆炸式重写"；逐阶段迁移且可验证。
- Master §29：no silent destructive migration；schema/config 升级可验证；风险 migration 前必须有可验证/可恢复备份；Cloud 不得假设所有 Desktop 同时升级。
- Master §30：backup metadata / schema version；migration-before-backup gate；restore compatibility smoke。
- R-07：sync-ready ≠ sync-enabled；Phase 1 只预留可加性，不实现同步。
- Task Template §18：new forward migration、不编辑历史 migration、rollback/recovery、兼容测试、migration smoke。
- Owner SHEEP-018 四项收紧（见各节）。

## 3. 现有迁移机制（审计摘要，CONFIRMED，未修改）

- `MigrationRunner`：`schema_migrations(version,name,checksum,applied_at)` + `app_meta`；
  事务执行、checksum 校验（历史迁移被改动即报错）、future-schema 拒绝、失败回滚、
  backup-before-upgrade（`backupDatabase`）。
- `migration-loader`：按 version 有序发现迁移；`schema-version` 维护当前 schema 版本契约。
- 历史迁移：`0001_initial.sql`、`0002_feedback_effect_tracking.sql`、
  `0003_learning_review_audit_optimization.sql`、`0004_legacy_import_tracking.sql`（checksum 已固化）。

## 4. 迁移纪律（Owner 收紧 #1 / #2）

- **0001~0004 永久不变**：不编辑、不重命名、不合并；其 checksum 是既有契约，改动即视为违规。
- **0005 起只追加**：保持唯一、有序、可审计的 forward migration。
- **不锁"一域一 migration"**：具体拆分/合并粒度由 SHEEP-019 按最小风险决定（可多域一批，也可单域一条），
  但任何新迁移都必须满足：唯一 version、有序、可审计、只新增。

## 5. Domain → Persistence mapping（描述性，不锁 schema）

> Owner 收紧 #1：以下只描述**需要持久化的实体、身份、scope、关系与能力**，
> **不锁定最终表名、列名、索引、外键、nullable 规则或数据库类型**；具体 schema 由 SHEEP-019 依 persistence 现状实施。

| 域模型（SHEEP） | 需持久化的实体/身份 | 关键 scope / 关系 / 能力 |
|---|---|---|
| Merchant（010） | Merchant、Store、PlatformAccount；AccountRef 身份引用能力（local/platform/cloud 边界） | Merchant 为租户根；Store 归属 Merchant；PlatformAccount 归属 Merchant |
| Membership/Seat（011） | Member、Membership、Seat；默认角色（owner/admin/supervisor/agent） | Membership 为 Member↔Merchant **唯一归属事实源**；Seat 为 merchant 作用域占位 |
| Authorization（012） | Capability 注册契约、ResourceScope（merchant/store/platformAccount）、RoleCapabilitySet | 授权层能力 registry 未预置；平台能力与授权能力分离 |
| Conversation Identity（013） | Conversation、Message 归一化身份 + 专属外部引用 | **storeId 已确认**（会话）；merchant/platformAccount scope |
| Ownership（014） | OwnershipState（8 态）、OwnershipActorRef（member/ai） | 归属记录按会话；当前 owner 最小能力 |
| Customer（015） | Customer 身份核心 | merchant/platformAccount scope；**Store 语义 DEFERRED** |
| Product/SKU（016） | Product、Sku | merchant/platformAccount scope；Sku→Product 归属；**Store 语义 DEFERRED** |
| Order/Logistics（017） | Order、Logistics | merchant/platformAccount scope；Logistics→Order 归属；**Store 语义 DEFERRED** |

### Store scope 分域处理（Owner 附加要求）

- **Conversation**：storeId 已确认 —— 持久化必须保留 store 作用域，**不得**因其它域的 Store 语义
  DEFERRED 而被统一省略。
- **Customer / Product / Order**：Store 语义 DEFERRED —— 当前实体契约不含 storeId；但 persistence
  结构不得封死未来以**可加方式**引入 store 关联（仅预留可加性，不实现）。

## 6. R-07 Sync-Ready 可加性（Owner 收紧 #4）

- **不规划任何实际 sync schema**：不预写 revision / deleted_at / remote_id / last_synced_at /
  pending_upload / Outbox 等字段或表。
- 只要求：**当前 persistence architecture 不封死未来追加这些能力**（例如：新增列/表始终走 forward
  migration；既有表不依赖会阻碍未来追加的硬约束）。
- 原则：`sync-ready != sync-enabled`；是否同步由 R-06 Data Authority / Sync Scope Matrix 决定（Phase 12）。

## 7. 备份 / 迁移安全顺序（Owner 收紧 #3）

- 遵循 Master §29/§30 与现有 `MigrationRunner` 契约的**既有安全顺序**，不因本文措辞改变：
  1. 高风险 migration 执行**前**，必须有**可验证、可恢复**的 backup evidence；
  2. schema version / backup metadata 依 Master 与 runner 契约维护；
  3. restore compatibility 需可验证（backup 可恢复，而非仅"存在备份文件"）。
- 本计划**不引入**新的安全顺序或门禁措辞；backup-before-upgrade 已由 MigrationRunner 执行。

## 8. 验证方式（SHEEP-019/020 承接）

- 新 migration：`MigrationRunner` 全量跑通（fresh 库 + 已升级库），checksum 记录正确；
- 兼容性：既有 0001~0004 升级路径回归（old baseline regression）；
- migration smoke：新增后当前 schema 版本正确、数据可读、backup/restore 可验证；
- 上述验证在 SHEEP-019（实施）与 SHEEP-020（兼容 smoke）执行，本文仅定义验收方向。

## 9. 开放 / DEFERRED

- Customer/Product/Order 的 Store 语义（各域已 DEFERRED，需未来治理证据）。
- M1.5 早期基础（SecretStore / Entitlement / Sync-Ready Contract）各自的 persistence 影响，按届时任务处理。
- 云权威身份（Phase 12）。