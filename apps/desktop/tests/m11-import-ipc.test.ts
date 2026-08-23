import { test } from "node:test";
import assert from "node:assert/strict";
import { createMainContext } from "../dist/main/bootstrap.js";
import { QUERY_HANDLERS, type QueryDeps } from "../dist/main/ipc/query-handlers.js";
import { COMMAND_HANDLERS, type CommandDeps } from "../dist/main/ipc/command-handlers.js";

test("legacy_import.select/status are wired as typed IPC channels", async () => {
  const ctx = createMainContext({ testMode: true });
  const deps = ctx as unknown as QueryDeps & CommandDeps;
  const select = await COMMAND_HANDLERS["legacy_import.select"](deps)({});
  assert.equal(select.ok, true);
  if (select.ok) assert.equal(select.data.item_count, 0);
  const status = await QUERY_HANDLERS["legacy_import.status"](deps)({ session_id: "nope" });
  assert.equal(status.ok, false);
});

test("legacy_import.plan/dry_run/apply/cancel are registered command handlers", () => {
  const ctx = createMainContext({ testMode: true });
  for (const ch of ["legacy_import.plan", "legacy_import.dry_run", "legacy_import.apply", "legacy_import.cancel", "legacy_import.scan"]) {
    assert.equal(typeof COMMAND_HANDLERS[ch as never], "function", ch);
  }
});
