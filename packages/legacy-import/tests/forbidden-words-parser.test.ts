import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseForbiddenWordsJson } from "../dist/parsers/forbidden-words-parser.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("forbidden words parser extracts canonical entries", () => {
  const rows = parseForbiddenWordsJson({ item_id: "i", display_name: "违禁词.json", path: join(FIX, "forbidden-words", "违禁词.json"), source_type: "forbidden_words" });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].term, "微信");
});
