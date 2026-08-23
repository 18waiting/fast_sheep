import { test } from "node:test";
import assert from "node:assert/strict";
import { BackupPolicy } from "../dist/index.js";

test("backup id is deterministic per product + timestamp", () => {
  const p = new BackupPolicy(() => 1000);
  const id = p.backupId("10001");
  assert.ok(id.startsWith("bk-10001-"));
  assert.equal(p.backupId("10001"), id);
});

test("backup dir is 备份/商品库合集/<ts>/", () => {
  const p = new BackupPolicy(() => 0);
  assert.equal(p.dir(), "备份/商品库合集/<ts>/");
});
