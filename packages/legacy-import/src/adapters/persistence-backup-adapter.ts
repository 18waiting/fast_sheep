// M11 persistence backup adapter (clean-room). Uses the existing M1 database
// backup infrastructure before the first import mutation.
import type { DatabaseBackupPort } from "../ports/database-backup-port.js";
import { backupDatabase } from "@fastwork/persistence";
import { randomUUID } from "node:crypto";
import { LegacyImportError, IMPORT_ERROR_CODES } from "../errors.js";

export class PersistenceBackupAdapter implements DatabaseBackupPort {
  constructor(private readonly databasePath: string, private readonly backupDir: string) {}
  backup(tag = "legacy-import"): { backup_id: string; path: string } {
    const backupId = "bk-" + tag + "-" + randomUUID().slice(0, 8);
    const path = backupDatabase(this.databasePath, this.backupDir);
    if (!path) throw new LegacyImportError(IMPORT_ERROR_CODES.BACKUP_FAILED, "database backup failed");
    return { backup_id: backupId, path };
  }
}
