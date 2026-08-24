// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-A: Sqlite implementations for Phase 1 identity domain repositories.
import type { SqliteConnection } from "../db/sqlite-driver.js";
import type {
  MerchantRecord, StoreRecord, PlatformAccountRecord, MemberRecord,
  MembershipRecord, SeatRecord,
  MerchantRepository, StoreRepository, PlatformAccountRepository,
  MemberRepository, MembershipRepository, SeatRepository,
} from "../repositories/identity-repositories.js";

interface MerchantRow { id: string; name: string; }
interface StoreRow { id: string; merchant_id: string; name: string; platform: string; }
interface PlatformAccountRow { id: string; merchant_id: string; platform: string; external_ref: string | null; }
interface MemberRow { id: string; account_ref_kind: string; account_ref_value: string; }
interface MembershipRow { id: string; merchant_id: string; member_id: string; role: string; }
interface SeatRow { id: string; merchant_id: string; }

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
}

export class SqliteMemberRepository implements MemberRepository {
  constructor(private conn: SqliteConnection) {}
  save(m: MemberRecord): void {
    this.conn.run("INSERT INTO members (id, account_ref_kind, account_ref_value) VALUES (?, ?, ?)", m.id, m.accountRefKind, m.accountRefValue);
  }
  findById(id: string): MemberRecord | null {
    const r = this.conn.get<MemberRow | undefined>("SELECT id, account_ref_kind, account_ref_value FROM members WHERE id = ?", id);
    return r ? { id: r.id, accountRefKind: r.account_ref_kind as MemberRecord["accountRefKind"], accountRefValue: r.account_ref_value } : null;
  }
}

export class SqliteMembershipRepository implements MembershipRepository {
  constructor(private conn: SqliteConnection) {}
  save(m: MembershipRecord): void {
    this.conn.run("INSERT INTO memberships (id, merchant_id, member_id, role) VALUES (?, ?, ?, ?)", m.id, m.merchantId, m.memberId, m.role);
  }
  findById(id: string): MembershipRecord | null {
    const r = this.conn.get<MembershipRow | undefined>("SELECT id, merchant_id, member_id, role FROM memberships WHERE id = ?", id);
    return r ? { id: r.id, merchantId: r.merchant_id, memberId: r.member_id, role: r.role } : null;
  }
  listByMerchant(merchantId: string): MembershipRecord[] {
    return this.conn.all<MembershipRow>("SELECT id, merchant_id, member_id, role FROM memberships WHERE merchant_id = ? ORDER BY id", merchantId)
      .map((r) => ({ id: r.id, merchantId: r.merchant_id, memberId: r.member_id, role: r.role }));
  }
  listByMember(memberId: string): MembershipRecord[] {
    return this.conn.all<MembershipRow>("SELECT id, merchant_id, member_id, role FROM memberships WHERE member_id = ? ORDER BY id", memberId)
      .map((r) => ({ id: r.id, merchantId: r.merchant_id, memberId: r.member_id, role: r.role }));
  }
}

export class SqliteSeatRepository implements SeatRepository {
  constructor(private conn: SqliteConnection) {}
  save(s: SeatRecord): void {
    this.conn.run("INSERT INTO seats (id, merchant_id) VALUES (?, ?)", s.id, s.merchantId);
  }
  findById(id: string): SeatRecord | null {
    const r = this.conn.get<SeatRow | undefined>("SELECT id, merchant_id FROM seats WHERE id = ?", id);
    return r ? { id: r.id, merchantId: r.merchant_id } : null;
  }
  listByMerchant(merchantId: string): SeatRecord[] {
    return this.conn.all<SeatRow>("SELECT id, merchant_id FROM seats WHERE merchant_id = ? ORDER BY id", merchantId)
      .map((r) => ({ id: r.id, merchantId: r.merchant_id }));
  }
}