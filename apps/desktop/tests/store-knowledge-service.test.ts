// SHEEP-305: Store Knowledge Service tests (MVP-A, DEC-008 layer 3).
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { SqliteConnection } from "@fastwork/persistence";
import { createStoreKnowledgeService, type StoreKnowledgeService } from "../src/main/services/store-knowledge-service.js";

function createTestDb(): SqliteConnection {
  const db = new DatabaseSync(":memory:");
  // Run migration 0008
  db.exec(`
    CREATE TABLE store_knowledge (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('SHIPPING_TIME', 'RETURN_POLICY', 'FAQ', 'OTHER')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'OWNER_INPUT' CHECK (source IN ('OWNER_INPUT', 'IMPORTED')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'ARCHIVED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_store_knowledge_merchant ON store_knowledge(merchant_id);
    CREATE INDEX idx_store_knowledge_store ON store_knowledge(store_id);
    CREATE INDEX idx_store_knowledge_type ON store_knowledge(knowledge_type);
    CREATE INDEX idx_store_knowledge_status ON store_knowledge(status);
    CREATE INDEX idx_store_knowledge_scope ON store_knowledge(merchant_id, store_id, knowledge_type, status);
  `);
  // Wrap in SqliteConnection interface
  const conn = {
    path: ":memory:",
    run: (sql: string, ...params: unknown[]) => db.prepare(sql).run(...params),
    get: <T = Record<string, unknown>>(sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as T | undefined,
    all: <T = Record<string, unknown>>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[],
    exec: (sql: string) => db.exec(sql),
    transaction: <T>(fn: () => T): T => fn(),
    close: () => db.close(),
  } as unknown as SqliteConnection;
  return conn;
}

describe("StoreKnowledgeService (SHEEP-305)", () => {
  let conn: SqliteConnection;
  let service: StoreKnowledgeService;

  beforeEach(() => {
    conn = createTestDb();
    service = createStoreKnowledgeService(conn);
  });

  describe("upsert", () => {
    it("creates a new SHIPPING_TIME knowledge entry", () => {
      const entry = service.upsert({
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "SHIPPING_TIME",
        title: "常规发货时间",
        content: "支付成功后48小时内发货",
        tags: ["发货", "时间"],
      });

      assert.equal(entry.merchant_id, "m1");
      assert.equal(entry.store_id, "s1");
      assert.equal(entry.knowledge_type, "SHIPPING_TIME");
      assert.equal(entry.title, "常规发货时间");
      assert.equal(entry.content, "支付成功后48小时内发货");
      assert.deepEqual([...entry.tags], ["发货", "时间"]);
      assert.equal(entry.source, "OWNER_INPUT");
      assert.equal(entry.status, "ACTIVE");
      assert.ok(entry.id);
      assert.ok(entry.created_at);
      assert.ok(entry.updated_at);
    });

    it("updates an existing entry (preserves created_at)", () => {
      const created = service.upsert({
        id: "test-id-1",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "SHIPPING_TIME",
        title: "原始标题",
        content: "原始内容",
      });

      const updated = service.upsert({
        id: "test-id-1",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "SHIPPING_TIME",
        title: "更新标题",
        content: "更新内容",
      });

      assert.equal(updated.id, "test-id-1");
      assert.equal(updated.title, "更新标题");
      assert.equal(updated.content, "更新内容");
      assert.equal(updated.created_at, created.created_at);
      assert.notEqual(updated.updated_at, created.updated_at);
    });

    it("rejects invalid knowledge_type", () => {
      assert.throws(() => {
        service.upsert({
          merchant_id: "m1",
          store_id: "s1",
          knowledge_type: "INVALID" as any,
          title: "Test",
          content: "Test",
        });
      }, /invalid knowledge_type/);
    });

    it("rejects missing title", () => {
      assert.throws(() => {
        service.upsert({
          merchant_id: "m1",
          store_id: "s1",
          knowledge_type: "SHIPPING_TIME",
          title: "",
          content: "Test",
        });
      }, /title is required/);
    });

    it("rejects missing content", () => {
      assert.throws(() => {
        service.upsert({
          merchant_id: "m1",
          store_id: "s1",
          knowledge_type: "SHIPPING_TIME",
          title: "Test",
          content: "",
        });
      }, /content is required/);
    });

    it("enforces merchant scope on update", () => {
      service.upsert({
        id: "scope-test",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "SHIPPING_TIME",
        title: "Test",
        content: "Test",
      });

      assert.throws(() => {
        service.upsert({
          id: "scope-test",
          merchant_id: "m2", // different merchant
          store_id: "s1",
          knowledge_type: "SHIPPING_TIME",
          title: "Updated",
          content: "Updated",
        });
      }, /scope mismatch/);
    });
  });

  describe("get", () => {
    it("returns entry by id and merchant_id", () => {
      service.upsert({
        id: "get-test",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "FAQ",
        title: "Test FAQ",
        content: "FAQ content",
      });

      const entry = service.get("get-test", "m1");
      assert.ok(entry);
      assert.equal(entry.id, "get-test");
      assert.equal(entry.merchant_id, "m1");
    });

    it("returns null for non-existent entry", () => {
      const entry = service.get("non-existent", "m1");
      assert.equal(entry, null);
    });

    it("returns null for wrong merchant", () => {
      service.upsert({
        id: "merchant-test",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "FAQ",
        title: "Test",
        content: "Test",
      });

      const entry = service.get("merchant-test", "m2");
      assert.equal(entry, null);
    });
  });

  describe("list", () => {
    it("lists entries by merchant and store", () => {
      service.upsert({ merchant_id: "m1", store_id: "s1", knowledge_type: "SHIPPING_TIME", title: "T1", content: "C1" });
      service.upsert({ merchant_id: "m1", store_id: "s1", knowledge_type: "FAQ", title: "T2", content: "C2" });
      service.upsert({ merchant_id: "m1", store_id: "s2", knowledge_type: "SHIPPING_TIME", title: "T3", content: "C3" });

      const entries = service.list({ merchant_id: "m1", store_id: "s1" });
      assert.equal(entries.length, 2);
    });

    it("filters by knowledge_type", () => {
      service.upsert({ merchant_id: "m1", store_id: "s1", knowledge_type: "SHIPPING_TIME", title: "T1", content: "C1" });
      service.upsert({ merchant_id: "m1", store_id: "s1", knowledge_type: "FAQ", title: "T2", content: "C2" });

      const entries = service.list({ merchant_id: "m1", store_id: "s1", knowledge_type: "FAQ" });
      assert.equal(entries.length, 1);
      assert.equal(entries[0].knowledge_type, "FAQ");
    });

    it("filters by status", () => {
      service.upsert({ merchant_id: "m1", store_id: "s1", knowledge_type: "FAQ", title: "T1", content: "C1", status: "ACTIVE" });
      service.upsert({ merchant_id: "m1", store_id: "s1", knowledge_type: "FAQ", title: "T2", content: "C2", status: "DRAFT" });

      const entries = service.list({ merchant_id: "m1", store_id: "s1", status: "ACTIVE" });
      assert.equal(entries.length, 1);
      assert.equal(entries[0].status, "ACTIVE");
    });
  });

  describe("query (keyword retrieval)", () => {
    beforeEach(() => {
      service.upsert({
        id: "k1",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "SHIPPING_TIME",
        title: "常规发货时间",
        content: "支付成功后48小时内发货，周末节假日顺延",
        tags: ["发货", "时间", "48小时"],
      });
      service.upsert({
        id: "k2",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "RETURN_POLICY",
        title: "退货政策",
        content: "7天无理由退货，需保持商品完好",
        tags: ["退货", "7天"],
      });
      service.upsert({
        id: "k3",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "SHIPPING_TIME",
        title: "预售商品发货",
        content: "预售商品支付后7-15个工作日发货",
        tags: ["预售", "发货"],
      });
    });

    it("returns entries matching keywords in title", () => {
      const entries = service.query({ merchant_id: "m1", store_id: "s1", keywords: ["预售"] });
      assert.equal(entries.length, 1);
      assert.equal(entries[0].id, "k3");
    });

    it("returns entries matching keywords in content", () => {
      const entries = service.query({ merchant_id: "m1", store_id: "s1", keywords: ["48小时"] });
      assert.equal(entries.length, 1);
      assert.equal(entries[0].id, "k1");
    });

    it("returns entries matching keywords in tags", () => {
      const entries = service.query({ merchant_id: "m1", store_id: "s1", keywords: ["退货"] });
      assert.equal(entries.length, 1);
      assert.equal(entries[0].id, "k2");
    });

    it("returns entries matching ANY keyword (OR logic)", () => {
      const entries = service.query({ merchant_id: "m1", store_id: "s1", keywords: ["发货", "退货"] });
      assert.ok(entries.length >= 2); // k1, k2, k3 all match
    });

    it("filters by knowledge_type", () => {
      const entries = service.query({
        merchant_id: "m1",
        store_id: "s1",
        keywords: ["发货"],
        knowledge_type: "SHIPPING_TIME",
      });
      assert.ok(entries.every((e) => e.knowledge_type === "SHIPPING_TIME"));
    });

    it("defaults to ACTIVE status only", () => {
      service.upsert({
        id: "k4",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "SHIPPING_TIME",
        title: "草稿发货规则",
        content: "发货相关草稿",
        status: "DRAFT",
      });

      const entries = service.query({ merchant_id: "m1", store_id: "s1", keywords: ["发货"] });
      assert.ok(entries.every((e) => e.status === "ACTIVE"));
      assert.ok(!entries.find((e) => e.id === "k4"));
    });

    it("returns empty for no matches", () => {
      const entries = service.query({ merchant_id: "m1", store_id: "s1", keywords: ["不存在的关键词"] });
      assert.equal(entries.length, 0);
    });

    it("returns all ACTIVE entries when no keywords", () => {
      const entries = service.query({ merchant_id: "m1", store_id: "s1" });
      assert.equal(entries.length, 3); // k1, k2, k3 (all ACTIVE)
    });

    it("enforces merchant scope", () => {
      const entries = service.query({ merchant_id: "m2", store_id: "s1", keywords: ["发货"] });
      assert.equal(entries.length, 0);
    });
  });

  describe("delete", () => {
    it("deletes an existing entry", () => {
      service.upsert({
        id: "del-test",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "FAQ",
        title: "Test",
        content: "Test",
      });

      const deleted = service.delete("del-test", "m1");
      assert.equal(deleted, true);

      const entry = service.get("del-test", "m1");
      assert.equal(entry, null);
    });

    it("returns false for non-existent entry", () => {
      const deleted = service.delete("non-existent", "m1");
      assert.equal(deleted, false);
    });

    it("enforces merchant scope", () => {
      service.upsert({
        id: "scope-del",
        merchant_id: "m1",
        store_id: "s1",
        knowledge_type: "FAQ",
        title: "Test",
        content: "Test",
      });

      const deleted = service.delete("scope-del", "m2");
      assert.equal(deleted, false);

      const entry = service.get("scope-del", "m1");
      assert.ok(entry); // still exists
    });
  });

  describe("diagnostics", () => {
    it("returns correct counts", () => {
      service.upsert({ merchant_id: "m1", store_id: "s1", knowledge_type: "SHIPPING_TIME", title: "T1", content: "C1" });
      service.upsert({ merchant_id: "m1", store_id: "s1", knowledge_type: "FAQ", title: "T2", content: "C2" });
      service.upsert({ merchant_id: "m1", store_id: "s1", knowledge_type: "FAQ", title: "T3", content: "C3", status: "DRAFT" });

      const diag = service.diagnostics();
      assert.equal(diag.totalEntries, 3);
      assert.equal(diag.byType.SHIPPING_TIME, 1);
      assert.equal(diag.byType.FAQ, 2);
      assert.equal(diag.byStatus.ACTIVE, 2);
      assert.equal(diag.byStatus.DRAFT, 1);
      assert.equal(diag.aiCalls, 0);
      assert.equal(diag.sendCalls, 0);
    });

    it("tracks retrieval count", () => {
      service.query({ merchant_id: "m1", store_id: "s1" });
      service.query({ merchant_id: "m1", store_id: "s1" });

      const diag = service.diagnostics();
      assert.equal(diag.retrievalCount, 2);
    });
  });
});
