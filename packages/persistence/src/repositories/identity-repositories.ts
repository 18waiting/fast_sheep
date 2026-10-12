// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-A: Phase 1 identity domain persistence (Merchant/Store/PlatformAccount)
// — minimal repository operations only. Member/Membership/Seat removed in
// realignment B2 (FastWork has no membership/seat line; owner decision D2).
// Constraints:
// - No delete/hard-delete/tombstone operations (R-06 DATA governance unclosed).
// - No sync/revision/deleted_at/remote_id/Outbox fields.

// name = NULL means no trusted business/display-name fact (DP-103/I-24; unknown
// optional identity facts use NULL, never magic/empty values).
export interface MerchantRecord { id: string; name: string | null; }

export interface StoreRecord { id: string; merchantId: string; name: string; platform: string; }

export interface PlatformAccountRecord {
  id: string;
  merchantId: string;
  platform: string;
  /** Opaque platform-external identity reference (optional). */
  externalRef?: string | null;
}

export interface MerchantRepository {
  save(m: MerchantRecord): void;
  findById(id: string): MerchantRecord | null;
}

export interface StoreRepository {
  save(s: StoreRecord): void;
  findById(id: string): StoreRecord | null;
  listByMerchant(merchantId: string): StoreRecord[];
  /**
   * Shop vs Store 语义分离（参见 docs/architecture/SHOP_VS_STORE_SEMANTICS.md）
   * 通过 merchantId + platform 查找 Store，用于 Shop → Store 映射。
   */
  findByMerchantAndPlatform(merchantId: string, platform: string): StoreRecord | null;
}

export interface PlatformAccountRepository {
  save(p: PlatformAccountRecord): void;
  findById(id: string): PlatformAccountRecord | null;
  listByMerchant(merchantId: string): PlatformAccountRecord[];
  /**
   * Shop vs Store 语义分离（参见 docs/architecture/SHOP_VS_STORE_SEMANTICS.md）
   * 通过 externalRef 查找 PlatformAccount，用于 Shop.id → PlatformAccount 映射。
   * externalRef 存储了 Shop.id 的引用。
   */
  findByExternalRef(externalRef: string): PlatformAccountRecord | null;
}
