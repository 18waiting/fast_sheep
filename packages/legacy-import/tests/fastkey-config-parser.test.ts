import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFastkeyConfig } from "../dist/parsers/fastkey-config-parser.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("Fastkey parser maps GF-STORE-003 fields", () => {
  const r = parseFastkeyConfig({ item_id: "i", display_name: "Fastkey.json", path: join(FIX, "full-valid", "Fastkey.json"), source_type: "fastkey" });
  const collab = r.groups.find((g) => g.group === "CollaborationConfig")!;
  assert.equal(collab.payload.countdown_seconds, 5);
  const conv = r.groups.find((g) => g.group === "ConversationPolicyConfig")!;
  assert.equal(conv.payload.similarity_threshold, 1);
  const rag = r.groups.find((g) => g.group === "RAGConfig")!;
  assert.equal(rag.payload.product_fast_return_threshold, 0.9);
});
