import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSettingsJson } from "../dist/parsers/settings-parser.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("协同.json maps countdown/mode/single-thread", () => {
  const r = parseSettingsJson({ item_id: "i", display_name: "协同.json", path: join(FIX, "minimal-valid", "协同.json"), source_type: "settings" });
  assert.equal(r.group, "CollaborationConfig");
  assert.equal(r.payload.countdown_seconds, 5);
  assert.equal(r.payload.mode, "human_review");
});
