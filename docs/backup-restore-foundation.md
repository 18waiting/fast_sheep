# Backup / Restore Foundation（M1.5-R06）

> 项目：Fast Sheep / 快羊客服 · Phase 1 / M1.5 · 状态：FOUNDATION（Phase 1 提前项）· 更新：2026-08-25（REPAIR: Backup Creation Consistency）
> 范围：只解决 R-06 中 Phase 1 必须提前的 **Backup/Restore foundation**；**不代表整个 R-06
> （Retention / Cloud-Sync DATA / Deletion）已关闭**。其余 DATA decisions 保持在各自 Gate / DEFERRED。

## 1. 能力（packages/persistence/src/backup/backup-manager.ts）

- **createBackup(dbPath, backupRoot, schemaVersion)**：使用 SQLite 规范一致快照 **`VACUUM INTO`**
  生成 **完整、已提交、原子、单文件** 的 snapshot（含未 checkpoint 的 WAL 内容；活动连接下安全）；
  **不是**裸复制主 `.sqlite3` 文件。生成后先**实证校验**（可打开 / integrity=ok / 实际 schema==expected /
  实际≤supported），通过后落位 + 写 `backup-metadata.json`。**任何失败清理全部半成品**，
  不完整文件不会进入 `listBackups()` 可恢复集合。
- **listBackups(backupRoot)**：按时间倒序列出；**路径逃逸/损坏 metadata 跳过，不跟随**。
- **restoreBackup(backupFile, targetDb)**：**受控恢复**（要求目标关闭/独占；staging→validation→
  controlled rename；Windows 对在用文件 rename 安全失败）；校验基于 **DB 实证**；
  失败不替换当前可用 DB；恢复后 forward migration 由 `MigrationRunner` 负责。
- **rotateBackups(backupRoot, maxBackups)**：**仅机制**；显式 maxBackups；**无产品默认/retention 天数**；
  非法值 fail-safe（抛错不删）；**不自动挂接**。
- **路径约束**：所有读/恢复/rotation 路径受 `backupRoot` 约束（`assertWithin`）。

## 2. 未改变项（REPAIR 确认）

- **MigrationRunner 既有 migration-before-upgrade backup（`backupDatabase`）保持原样** —— 本 REPAIR
  未改动其行为；如需改为 WAL 一致快照，属另行决策。
- schema v7 不变；0001~0007 migrations 不修改；Secret 边界按职责（不宣称 R-01 前已完整证明）。

## 3. 本任务未解决（R-06 其余，保持 Gate/DEFERRED）

- 最终 retention 时长 / rotation 自动 cadence（`FINAL_RETENTION_DURATIONS`）
- Cloud sync scope（`FINAL_CLOUD_SYNC_DATA_SCOPE`）/ deletion / cloud-sync DATA decisions