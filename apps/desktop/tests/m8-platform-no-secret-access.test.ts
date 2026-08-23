import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}
const FILES = walk(SRC).filter((f) => f.includes("platforms") || f.includes("platform-preloads"));

test("no cookie/token/password/captcha/stealth in M8 platform code", () => {
  for (const f of FILES) {
    const c = readFileSync(f, "utf-8");
    for (const token of ["session.cookies", "document.cookie", "cookieStore", "access_token", "extractToken", "getAuthToken", "password", "captcha", "recaptcha", "webdriver", "stealth", "navigator.fingerprint", "AutomationControlled"]) {
      assert.ok(!c.includes(token), f + " must not contain " + token);
    }
  }
});

test("no executeJavaScript command surface in platform page preloads", () => {
  for (const f of FILES.filter((x) => x.includes("preload"))) {
    const c = readFileSync(f, "utf-8");
    assert.ok(!c.includes("executeJavaScript"), f);
  }
});
