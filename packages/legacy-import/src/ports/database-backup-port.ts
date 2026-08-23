// M11 database backup port (clean-room). Durable backup before the first mutation.
export interface DatabaseBackupPort {
  backup(tag?: string): { backup_id: string; path: string };
}
