import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}
const FILES = walk(ROOT);

test("no cookie read/export API usage in M7 platform application code", () => {
  for (const f of FILES) {
    const c = readFileSync(f, "utf-8");
    for (const token of ["cookies.get", "cookies.set", "cookieStore", "session.cookies", "getCookies(", "exportCookie", "readCookie"]) {
      assert.ok(!c.includes(token), f + " must not read/export cookies via " + token);
    }
  }
});

test("no token extraction / password handling in platform code", () => {
  for (const f of FILES) {
    const c = readFileSync(f, "utf-8");
    for (const token of ["extractToken", "getAuthToken", "access_token", "password", "credential", "login(username", "typePassword", "fillLogin"]) {
      assert.ok(!c.toLowerCase().includes(token.toLowerCase()), f + " must not handle auth material: " + token);
    }
  }
});

test("session partition names never embed secrets", () => {
  const part = readFileSync(join(ROOT, "main", "platforms", "pdd", "pdd-session-partition.ts"), "utf-8");
  assert.ok(!part.includes("token") && !part.includes("cookie") && !part.includes("password"));
});
