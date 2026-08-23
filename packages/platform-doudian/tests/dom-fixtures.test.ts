import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DOUDIAN_SELECTOR_PROFILE, doudianDomHealth } from "../dist/index.js";
import { loadFixture } from "./helpers.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("all fixtures are self-contained and exercise the selector profile", () => {
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".html"));
  assert.ok(files.length >= 9);
  for (const f of files) {
    const html = readFileSync(join(FIXTURES, f), "utf-8");
    assert.ok(!/src=["']https?:|href=["']https?:|url\(https?:/.test(html), f + " external resource");
    assert.ok(!html.includes("张三") && !html.includes("13800138000"), f + " real customer data");
    doudianDomHealth(loadFixture(f));
  }
  assert.equal(DOUDIAN_SELECTOR_PROFILE.version, "doudian-dom-1.0.0");
});
