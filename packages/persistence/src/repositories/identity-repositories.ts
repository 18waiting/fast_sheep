// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
// SHEEP-019-A: Phase 1 identity domain persistence (Merchant/Store/PlatformAccount/
// Member/Membership/Seat) — minimal repository operations only.
// Constraints:
// - No delete/hard-delete/tombstone operations (R-06 DATA governance unclosed).
// - Member has NO merchantId (Membership is the single Member<->Merchant ownership source).
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

/** Member identity record — deliberately NO merchantId (single ownership source = Membership). */
export interface MemberRecord {
  id: string;
  accountRefKind: "local" | "platform" | "cloud";
  accountRefValue: string;
}

export interface MembershipRecord { id: string; merchantId: string; memberId: string; role: string; }

export interface SeatRecord { id: string; merchantId: string; }

export interface MerchantRepository {
  save(m: MerchantRecord): void;
  findById(id: string): MerchantRecord | null;
}

export interface StoreRepository {
  save(s: StoreRecord): void;
  findById(id: string): StoreRecord | null;
  listByMerchant(merchantId: string): StoreRecord[];
}

export interface PlatformAccountRepository {
  save(p: PlatformAccountRecord): void;
  findById(id: string): PlatformAccountRecord | null;
  listByMerchant(merchantId: string): PlatformAccountRecord[];
}

export interface MemberRepository {
  save(m: MemberRecord): void;
  findById(id: string): MemberRecord | null;
  // No merchant-scope query: Member does not own the merchant ownership fact.
}

export interface MembershipRepository {
  save(m: MembershipRecord): void;
  findById(id: string): MembershipRecord | null;
  listByMerchant(merchantId: string): MembershipRecord[];
  listByMember(memberId: string): MembershipRecord[];
}

export interface SeatRepository {
  save(s: SeatRecord): void;
  findById(id: string): SeatRecord | null;
  listByMerchant(merchantId: string): SeatRecord[];
}

