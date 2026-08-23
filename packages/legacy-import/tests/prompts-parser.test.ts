import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePromptsJson } from "../dist/parsers/prompts-parser.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("prompts parser extracts profiles + active ids", () => {
  const r = parsePromptsJson({ item_id: "i", display_name: "提示词.json", path: join(FIX, "prompts", "提示词.json"), source_type: "prompts" });
  assert.equal(r.prompts.length, 1);
  assert.equal(r.prompts[0].id, "p1");
  assert.deepEqual(r.active_ids, { "未下单": "p1" });
});
