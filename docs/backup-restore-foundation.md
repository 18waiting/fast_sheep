# Backup / Restore Foundation（M1.5-R06）

> 项目：Fast Sheep / 快羊客服 · Phase 1 / M1.5 · 状态：FOUNDATION（Phase 1 提前项）· 更新：2026-08-25
> 范围：只解决 R-06 中 Phase 1 必须提前的 **Backup/Restore foundation**；**不代表整个 R-06
> （Retention / Cloud-Sync DATA / Deletion）已关闭**。其余 DATA decisions 保持在各自 Gate / DEFERRED。

## 1. 能力（packages/persistence/src/backup/backup-manager.ts）

- **createBackup(dbPath, backupRoot, schemaVersion)**：复用既有已验证的 `backupDatabase`
  snapshot boundary（**无第二套 backup 实现**）；写 `backup-metadata.json`（createdAt、schema version、文件名）。
- **listBackups(backupRoot)**：按时间倒序列出；**路径逃逸/损坏 metadata 跳过，不跟随**。
- **restoreBackup(backupFile, targetDb)**：**受控恢复（controlled restore）**：
  - 要求目标 DB 关闭/独占（Windows 上对在用文件 rename 会安全失败，当前库不受损）；
  - **staging → validation → controlled replacement**（复制到同目录 staging，校验通过后原子 rename 替换）；
  - 校验基于 **DB 实证**：可打开为 SQLite、integrity_check=ok、**DB 实际 schema 版本 == metadata**、
    **实际版本 ≤ supported**（metadata 只是证据/索引，不是权威事实源）；
  - 失败清理 staging，**当前可用 DB 不被替换、内容保持可读**；
  - 恢复后 forward migration 由 `MigrationRunner` 负责，BackupManager 不自行升级 schema。
- **rotateBackups(backupRoot, maxBackups)**：**仅机制，不决定 retention policy**：
  显式 maxBackups（调用参数/测试输入）；**无产品默认 N、无 retention 天数**；
  非法值（<1、非整数）**fail-safe**（抛错、不删任何备份）；**不自动挂接** startup/migration/createBackup。
- **路径约束**：所有读取/恢复/rotation 路径必须位于 `backupRoot` 内（`assertWithin`）；
  metadata 中的路径不允许导致越界访问。

## 2. 边界与不变式

- **Secret 边界（按职责）**：BackupManager 只接受 databasePath / backupRoot / schemaVersion，
  只备份 DB + 必要 metadata；**不主动收集 SecretStore / credential / env / 其它用户文件**。
  **不宣称**已完整证明 SecretStore plaintext 永不进入 SQLite —— 该完整安全不变式由
  **R-01 + 本 Backup boundary 共同形成**（R-01 后补真实 negative integration test）。
- **schema v7 保持不变；0001~0007 migrations 不修改；MigrationRunner / `backupDatabase` 行为不修改。**

## 3. 本任务未解决（R-06 其余，保持 Gate/DEFERRED）

- 最终 retention 时长 / rotation 自动 cadence（`FINAL_RETENTION_DURATIONS`）
- Cloud sync scope（`FINAL_CLOUD_SYNC_DATA_SCOPE`）/ deletion / cloud-sync DATA decisions