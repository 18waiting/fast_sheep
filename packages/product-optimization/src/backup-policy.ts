// M10 backup policy (clean-room): durable backup before product update.
export class BackupPolicy {
  constructor(private readonly now: () => number) {}
  backupId(productId: string): string { return "bk-" + productId + "-" + this.now().toString(36); }
  dir(): string { return "备份/商品库合集/<ts>/"; }
}
