import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "platform-preloads");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

test("platform preloads expose nothing to the seller page", () => {
  const files = walk(ROOT);
  assert.equal(files.length, 5);
  for (const f of files) {
    const c = readFileSync(f, "utf-8");
    assert.ok(!c.includes("contextBridge.exposeInMainWorld"), f + " must not expose an API");
    assert.ok(!/eval\(|new Function/.test(c), f + " no eval");
    assert.ok(!c.includes("ipcRenderer.send") || c.includes("page-event"), f + " only platform-scoped events");
  }
});

test("platform preloads use dedicated scoped channels", () => {
  for (const id of ["doudian", "jd", "kuaishou", "qianniu", "xianyu"]) {
    const c = readFileSync(join(ROOT, id + ".ts"), "utf-8");
    assert.ok(c.includes(`"${id}-page-event"`), id + " event channel");
    assert.ok(c.includes(`"${id}-page-command"`), id + " command channel");
    assert.ok(c.includes(`"${id}-page-command-result"`), id + " result channel");
  }
});
