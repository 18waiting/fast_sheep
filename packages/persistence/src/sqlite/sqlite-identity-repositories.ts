// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-A: Sqlite implementations for Phase 1 identity domain repositories.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type {
  MerchantRecord, StoreRecord, PlatformAccountRecord,
  MerchantRepository, StoreRepository, PlatformAccountRepository,
} from "../repositories/identity-repositories.js";

interface MerchantRow { id: string; name: string | null; }
interface StoreRow { id: string; merchant_id: string; name: string; platform: string; }
interface PlatformAccountRow { id: string; merchant_id: string; platform: string; external_ref: string | null; }

export class SqliteMerchantRepository implements MerchantRepository {
  constructor(private conn: SqliteConnection) {}
  save(m: MerchantRecord): void {
    this.conn.run("INSERT INTO merchants (id, name) VALUES (?, ?)", m.id, m.name);
  }
  findById(id: string): MerchantRecord | null {
    const r = this.conn.get<MerchantRow | undefined>("SELECT id, name FROM merchants WHERE id = ?", id);
    return r ? { id: r.id, name: r.name } : null;
  }
}

export class SqliteStoreRepository implements StoreRepository {
  constructor(private conn: SqliteConnection) {}
  save(s: StoreRecord): void {
    this.conn.run("INSERT INTO stores (id, merchant_id, name, platform) VALUES (?, ?, ?, ?)", s.id, s.merchantId, s.name, s.platform);
  }
  findById(id: string): StoreRecord | null {
    const r = this.conn.get<StoreRow | undefined>("SELECT id, merchant_id, name, platform FROM stores WHERE id = ?", id);
    return r ? { id: r.id, merchantId: r.merchant_id, name: r.name, platform: r.platform } : null;
  }
  listByMerchant(merchantId: string): StoreRecord[] {
    return this.conn.all<StoreRow>("SELECT id, merchant_id, name, platform FROM stores WHERE merchant_id = ? ORDER BY id", merchantId)
      .map((r) => ({ id: r.id, merchantId: r.merchant_id, name: r.name, platform: r.platform }));
  }
  findByMerchantAndPlatform(merchantId: string, platform: string): StoreRecord | null {
    const r = this.conn.get<StoreRow | undefined>("SELECT id, merchant_id, name, platform FROM stores WHERE merchant_id = ? AND platform = ?", merchantId, platform);
    return r ? { id: r.id, merchantId: r.merchant_id, name: r.name, platform: r.platform } : null;
  }
}

export class SqlitePlatformAccountRepository implements PlatformAccountRepository {
  constructor(private conn: SqliteConnection) {}
  save(p: PlatformAccountRecord): void {
    this.conn.run("INSERT INTO platform_accounts (id, merchant_id, platform, external_ref) VALUES (?, ?, ?, ?)", p.id, p.merchantId, p.platform, p.externalRef ?? null);
  }
  findById(id: string): PlatformAccountRecord | null {
    const r = this.conn.get<PlatformAccountRow | undefined>("SELECT id, merchant_id, platform, external_ref FROM platform_accounts WHERE id = ?", id);
    return r ? { id: r.id, merchantId: r.merchant_id, platform: r.platform, externalRef: r.external_ref } : null;
  }
  listByMerchant(merchantId: string): PlatformAccountRecord[] {
    return this.conn.all<PlatformAccountRow>("SELECT id, merchant_id, platform, external_ref FROM platform_accounts WHERE merchant_id = ? ORDER BY id", merchantId)
      .map((r) => ({ id: r.id, merchantId: r.merchant_id, platform: r.platform, externalRef: r.external_ref }));
  }
  findByExternalRef(externalRef: string): PlatformAccountRecord | null {
    const r = this.conn.get<PlatformAccountRow | undefined>("SELECT id, merchant_id, platform, external_ref FROM platform_accounts WHERE external_ref = ?", externalRef);
    return r ? { id: r.id, merchantId: r.merchant_id, platform: r.platform, externalRef: r.external_ref } : null;
  }
}
