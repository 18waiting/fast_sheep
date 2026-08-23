import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, SqliteConnection, DB_FILENAME } from "../dist/index.js";

function root() { return mkdtempSync(join(tmpdir(), "fw-t-")); }
function open() { return openDatabase(root()); }

import { SqliteConversationRepository } from "../dist/index.js";
test("conversation create, append message, atomic updated_at, queries, rollback, close/reopen", () => {
  const r = root();
  const a = openDatabase(r);
  const repo = new SqliteConversationRepository(a.conn);
  repo.ensureConversation({ conversation_id: "c1", shop_id: "s1", buyer: "张三", started_at: "2026-08-15T00:00:00Z", updated_at: "2026-08-15T00:00:00Z", state: "active" });
  repo.appendMessage({ message_id: "m1", conversation_id: "c1", shop_id: "s1", platform: "pdd", buyer: "张三", type: "text", content: "你好", role: "buyer", created_at: "2026-08-15T00:00:01Z" });
  repo.appendMessage({ message_id: "m2", conversation_id: "c1", shop_id: "s1", platform: "pdd", buyer: "张三", type: "text", content: "在的", role: "ai", created_at: "2026-08-15T00:00:02Z" });
  assert.equal(repo.getConversation("c1").updated_at, "2026-08-15T00:00:02Z");
  assert.equal(repo.listMessages("c1").length, 2);
  assert.equal(repo.queryByBuyer("张三", "s1").length, 1);
  assert.equal(repo.queryRange("2026-08-15T00:00:00Z", "2026-08-15T00:00:03Z").length, 2);
  // rollback append
  assert.throws(() => a.conn.transaction(() => { repo.appendMessage({ message_id: "m3", conversation_id: "c1", shop_id: "s1", platform: "pdd", buyer: "张三", type: "text", content: "x", role: "ai", created_at: "2026-08-15T00:00:03Z" }); throw new Error("injected"); }));
  assert.equal(repo.listMessages("c1", 100).length, 2);
  a.conn.close();
  const b = openDatabase(r);
  assert.equal(new SqliteConversationRepository(b.conn).getConversation("c1").updated_at, "2026-08-15T00:00:02Z");
  b.conn.close();
});
