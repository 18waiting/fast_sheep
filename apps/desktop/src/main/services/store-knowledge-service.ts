// SHEEP-305 — Store Knowledge Service (DEC-008 layer 3).
//
// Minimal knowledge pipeline for MVP-A:
//   - CRUD for Store Knowledge entries (merchant-scoped, store-scoped)
//   - Keyword-based retrieval (SQL LIKE matching on title, content, tags)
//   - No vector retrieval (deferred to Phase 9)
//   - No learning model (deferred to Phase 9)
//   - No send capability
//
// Architecture alignment:
//   - DEC-008: Store Knowledge is layer 3 (Store scope)
//   - PDD_MVP_V1 §6: Authoritative V1 knowledge = Owner-supplied shop rules
//   - SHIPPING_TIME rules are Store Knowledge, not standalone fact providers

import type { SqliteConnection } from "@fastwork/persistence";

export type KnowledgeType = "SHIPPING_TIME" | "RETURN_POLICY" | "FAQ" | "OTHER";
export type KnowledgeSource = "OWNER_INPUT" | "IMPORTED";
export type KnowledgeStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export interface StoreKnowledgeEntry {
  readonly id: string;
  readonly merchant_id: string;
  readonly store_id: string;
  readonly knowledge_type: KnowledgeType;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly source: KnowledgeSource;
  readonly status: KnowledgeStatus;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface StoreKnowledgeUpsertInput {
  readonly id?: string;
  readonly merchant_id: string;
  readonly store_id: string;
  readonly knowledge_type: KnowledgeType;
  readonly title: string;
  readonly content: string;
  readonly tags?: readonly string[];
  readonly source?: KnowledgeSource;
  readonly status?: KnowledgeStatus;
}

export interface StoreKnowledgeQueryInput {
  readonly merchant_id: string;
  readonly store_id: string;
  readonly knowledge_type?: KnowledgeType;
  readonly keywords?: readonly string[];
  readonly status?: KnowledgeStatus;
  readonly limit?: number;
}

export interface StoreKnowledgeService {
  upsert(input: StoreKnowledgeUpsertInput): StoreKnowledgeEntry;
  get(id: string, merchant_id: string): StoreKnowledgeEntry | null;
  list(query: StoreKnowledgeQueryInput): readonly StoreKnowledgeEntry[];
  query(query: StoreKnowledgeQueryInput): readonly StoreKnowledgeEntry[];
  delete(id: string, merchant_id: string): boolean;
  diagnostics(): StoreKnowledgeDiagnostics;
}

export interface StoreKnowledgeDiagnostics {
  readonly totalEntries: number;
  readonly byType: Readonly<Record<KnowledgeType, number>>;
  readonly byStatus: Readonly<Record<KnowledgeStatus, number>>;
  readonly retrievalCount: number;
  readonly aiCalls: 0;
  readonly sendCalls: 0;
  readonly sideEffectGuarantee: "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT";
}

const KNOWLEDGE_TYPES: readonly KnowledgeType[] = ["SHIPPING_TIME", "RETURN_POLICY", "FAQ", "OTHER"];
const KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = ["OWNER_INPUT", "IMPORTED"];
const KNOWLEDGE_STATUSES: readonly KnowledgeStatus[] = ["ACTIVE", "DRAFT", "ARCHIVED"];

function isValidType(value: string): value is KnowledgeType {
  return KNOWLEDGE_TYPES.includes(value as KnowledgeType);
}

function isValidSource(value: string): value is KnowledgeSource {
  return KNOWLEDGE_SOURCES.includes(value as KnowledgeSource);
}

function isValidStatus(value: string): value is KnowledgeStatus {
  return KNOWLEDGE_STATUSES.includes(value as KnowledgeStatus);
}

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseTags(raw: string): readonly string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? Object.freeze(parsed.filter((t: unknown) => typeof t === "string")) : Object.freeze([]);
  } catch {
    return Object.freeze([]);
  }
}

function mapRow(row: Record<string, unknown>): StoreKnowledgeEntry {
  return Object.freeze({
    id: row.id as string,
    merchant_id: row.merchant_id as string,
    store_id: row.store_id as string,
    knowledge_type: row.knowledge_type as KnowledgeType,
    title: row.title as string,
    content: row.content as string,
    tags: parseTags(row.tags as string),
    source: row.source as KnowledgeSource,
    status: row.status as KnowledgeStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  });
}

export function createStoreKnowledgeService(conn: SqliteConnection): StoreKnowledgeService {
  let retrievalCount = 0;

  function ensureTable(): void {
    const exists = conn.get<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='store_knowledge'");
    if (!exists) {
      throw new Error("store_knowledge table not found — run migration 0008 first");
    }
  }

  return {
    upsert(input: StoreKnowledgeUpsertInput): StoreKnowledgeEntry {
      ensureTable();
      if (!input.merchant_id) throw new Error("merchant_id is required");
      if (!input.store_id) throw new Error("store_id is required");
      if (!isValidType(input.knowledge_type)) throw new Error(`invalid knowledge_type: ${input.knowledge_type}`);
      if (!input.title?.trim()) throw new Error("title is required");
      if (!input.content?.trim()) throw new Error("content is required");

      const id = input.id ?? generateId();
      const now = new Date().toISOString();
      const tags = JSON.stringify(input.tags ?? []);
      const source = input.source && isValidSource(input.source) ? input.source : "OWNER_INPUT";
      const status = input.status && isValidStatus(input.status) ? input.status : "ACTIVE";

      const existing = conn.get<{ id: string }>("SELECT id FROM store_knowledge WHERE id = ?", id);

      if (existing) {
        const existingRow = conn.get<Record<string, unknown>>(
          "SELECT * FROM store_knowledge WHERE id = ? AND merchant_id = ?",
          id,
          input.merchant_id
        );
        if (!existingRow) throw new Error("knowledge entry not found or scope mismatch");
        conn.run(
          `UPDATE store_knowledge SET store_id = ?, knowledge_type = ?, title = ?, content = ?, tags = ?, source = ?, status = ?, updated_at = ? WHERE id = ? AND merchant_id = ?`,
          input.store_id,
          input.knowledge_type,
          input.title,
          input.content,
          tags,
          source,
          status,
          now,
          id,
          input.merchant_id
        );
      } else {
        conn.run(
          `INSERT INTO store_knowledge (id, merchant_id, store_id, knowledge_type, title, content, tags, source, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          input.merchant_id,
          input.store_id,
          input.knowledge_type,
          input.title,
          input.content,
          tags,
          source,
          status,
          now,
          now
        );
      }

      const row = conn.get<Record<string, unknown>>("SELECT * FROM store_knowledge WHERE id = ?", id);
      return mapRow(row!);
    },

    get(id: string, merchant_id: string): StoreKnowledgeEntry | null {
      ensureTable();
      const row = conn.get<Record<string, unknown>>(
        "SELECT * FROM store_knowledge WHERE id = ? AND merchant_id = ?",
        id,
        merchant_id
      );
      return row ? mapRow(row) : null;
    },

    list(query: StoreKnowledgeQueryInput): readonly StoreKnowledgeEntry[] {
      ensureTable();
      if (!query.merchant_id) throw new Error("merchant_id is required");
      if (!query.store_id) throw new Error("store_id is required");

      const conditions: string[] = ["merchant_id = ?", "store_id = ?"];
      const params: (string | number)[] = [query.merchant_id, query.store_id];

      if (query.knowledge_type) {
        conditions.push("knowledge_type = ?");
        params.push(query.knowledge_type);
      }
      if (query.status) {
        conditions.push("status = ?");
        params.push(query.status);
      }

      const limit = query.limit ?? 100;
      const sql = `SELECT * FROM store_knowledge WHERE ${conditions.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`;
      params.push(limit);

      const rows = conn.all<Record<string, unknown>>(sql, ...params);
      return Object.freeze(rows.map(mapRow));
    },

    query(query: StoreKnowledgeQueryInput): readonly StoreKnowledgeEntry[] {
      ensureTable();
      retrievalCount += 1;

      if (!query.merchant_id) throw new Error("merchant_id is required");
      if (!query.store_id) throw new Error("store_id is required");

      const conditions: string[] = ["merchant_id = ?", "store_id = ?"];
      const params: (string | number)[] = [query.merchant_id, query.store_id];

      if (query.knowledge_type) {
        conditions.push("knowledge_type = ?");
        params.push(query.knowledge_type);
      }
      if (query.status) {
        conditions.push("status = ?");
        params.push(query.status);
      } else {
        conditions.push("status = 'ACTIVE'");
      }

      // Keyword matching: LIKE on title, content, tags
      if (query.keywords && query.keywords.length > 0) {
        const keywordConditions = query.keywords.map(() => "(title LIKE ? OR content LIKE ? OR tags LIKE ?)");
        conditions.push(`(${keywordConditions.join(" OR ")})`);
        for (const kw of query.keywords) {
          const pattern = `%${kw}%`;
          params.push(pattern, pattern, pattern);
        }
      }

      const limit = query.limit ?? 20;
      const sql = `SELECT * FROM store_knowledge WHERE ${conditions.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`;
      params.push(limit);

      const rows = conn.all<Record<string, unknown>>(sql, ...params);
      return Object.freeze(rows.map(mapRow));
    },

    delete(id: string, merchant_id: string): boolean {
      ensureTable();
      const before = conn.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM store_knowledge WHERE id = ? AND merchant_id = ?",
        id,
        merchant_id
      );
      conn.run("DELETE FROM store_knowledge WHERE id = ? AND merchant_id = ?", id, merchant_id);
      const after = conn.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM store_knowledge WHERE id = ? AND merchant_id = ?",
        id,
        merchant_id
      );
      return (before?.count ?? 0) > (after?.count ?? 0);
    },

    diagnostics(): StoreKnowledgeDiagnostics {
      ensureTable();
      const total = conn.get<{ count: number }>("SELECT COUNT(*) as count FROM store_knowledge")?.count ?? 0;

      const byType: Record<string, number> = {};
      for (const t of KNOWLEDGE_TYPES) byType[t] = 0;
      const typeRows = conn.all<{ knowledge_type: string; count: number }>(
        "SELECT knowledge_type, COUNT(*) as count FROM store_knowledge GROUP BY knowledge_type"
      );
      for (const row of typeRows) {
        if (isValidType(row.knowledge_type)) byType[row.knowledge_type] = row.count;
      }

      const byStatus: Record<string, number> = {};
      for (const s of KNOWLEDGE_STATUSES) byStatus[s] = 0;
      const statusRows = conn.all<{ status: string; count: number }>(
        "SELECT status, COUNT(*) as count FROM store_knowledge GROUP BY status"
      );
      for (const row of statusRows) {
        if (isValidStatus(row.status)) byStatus[row.status] = row.count;
      }

      return Object.freeze({
        totalEntries: total,
        byType: Object.freeze(byType) as Readonly<Record<KnowledgeType, number>>,
        byStatus: Object.freeze(byStatus) as Readonly<Record<KnowledgeStatus, number>>,
        retrievalCount,
        aiCalls: 0,
        sendCalls: 0,
        sideEffectGuarantee: "STRUCTURAL_INVARIANT_NOT_A_RUNTIME_MEASUREMENT" as const,
      });
    },
  };
}
