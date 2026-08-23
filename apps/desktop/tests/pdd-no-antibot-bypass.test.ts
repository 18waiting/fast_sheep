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

test("no CAPTCHA automation anywhere in M7 code", () => {
  for (const f of FILES) {
    const c = readFileSync(f, "utf-8");
    assert.ok(!/captcha|recaptcha|geetest|hcaptcha/i.test(c), f + " must not automate CAPTCHA");
  }
});

test("no anti-bot bypass / webdriver evasion / fingerprint spoofing", () => {
  const forbidden = ["webdriver", "stealth", "fingerprint", "navigator.webdriver", "chrome.runtime", "headless:false", "disable-blink-features", "AutomationControlled"];
  for (const f of FILES) {
    const c = readFileSync(f, "utf-8");
    for (const token of forbidden) {
      assert.ok(!c.includes(token), f + " must not contain " + token);
    }
  }
});

test("no generic remote-control page commands (execute_js/click_selector/run_script)", () => {
  const cmdHandler = readFileSync(join(ROOT, "platforms", "pdd", "preload.ts"), "utf-8");
  const pagePkg = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "platform-pdd", "src", "page", "command-handler.ts"), "utf-8");
  for (const token of ["execute_js", "click_selector", "query_selector", "set_html", "run_script", "executeJavaScript"]) {
    assert.ok(!cmdHandler.includes(token) && !pagePkg.includes(token), "forbidden generic command " + token);
  }
});

test("no arbitrary eval / Function constructor in the PDD page preload", () => {
  const preload = readFileSync(join(ROOT, "platforms", "pdd", "preload.ts"), "utf-8");
  const bundled = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "platforms", "pdd", "preload.js"), "utf-8");
  for (const src of [preload, bundled]) {
    assert.ok(!/eval\(|new Function|Function\(/.test(src), "no eval/Function constructor");
  }
});
