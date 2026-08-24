# Backup / Restore Foundation（M1.5-R06）

> 项目：Fast Sheep / 快羊客服 · Phase 1 / M1.5 · 状态：FOUNDATION（Phase 1 提前项）· 日期：2026-08-24
> 范围：只解决 R-06 中 Phase 1 必须提前的 **Backup/Restore foundation**；**不代表整个 R-06
> （Retention / Cloud-Sync DATA / Deletion）已关闭**。其余 DATA decisions 保持在各自 Gate / DEFERRED。

## 1. 能力（packages/persistence/src/backup/backup-manager.ts）

- **createBackup(dbPath, backupRoot, schemaVersion)**：复用既有已验证的 `backupDatabase`
  snapshot boundary（**无第二套 backup 实现**）；写 `backup-metadata.json`（createdAt、schema version、文件名）。
- **listBackups(backupRoot)**：按时间倒序列出（含元数据）。
- **restoreBackup(backupFile, targetDb)**：**fail-safe / atomic** —— 校验 backup（metadata 存在、
  schema ≤ supported、staging 副本 integrity_check + schema 校验）→ 通过后 rename 原子替换目标；
  失败清理 staging、**不损坏当前可用 DB**。恢复后 forward migration 由 `MigrationRunner` 负责，
  BackupManager 不自行升级 schema。
- **rotateBackups(backupRoot, maxBackups)**：**仅能力**，显式 maxBackups；**无 production 默认值**、
  **不自动挂接到 startup/migration/createBackup**（retention cadence/数量 = R-06 DATA Decision）。

## 2. 边界与不变式

- **Secret 排除**：BackupManager 只处理数据库文件 + 批准 metadata；**不读取/复制 SecretStore**。
  SecretStore→backup 真实 negative integration test 在 **R-01 完成后**补充；本任务**不宣称**
  SecretStore integration 已完整验证。
- **schema v7 保持不变；0001~0007 migrations 不修改；MigrationRunner / `backupDatabase` 行为不修改。**

## 3. 本任务未解决（R-06 其余，保持 Gate/DEFERRED）

- 最终 retention 时长（`FINAL_RETENTION_DURATIONS`）
- Cloud sync scope（`FINAL_CLOUD_SYNC_DATA_SCOPE`）/ deletion / cloud-sync DATA decisions
- rotation 自动 cadence / production 默认数量