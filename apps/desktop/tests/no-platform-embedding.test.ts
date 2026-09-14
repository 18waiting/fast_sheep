import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else if (/\.(ts|tsx|html|css)$/.test(entry)) out.push(p);
  }
  return out;
}

const ALL = listFiles(SRC);

test("no seller platform embedding (no <webview>/BrowserView; WebContentsView is Main-owned)", () => {
  const pddViewHost = join(SRC, "main", "platforms", "pdd", "pdd-view-host.ts");
  for (const f of ALL) {
    const content = readFileSync(f, "utf-8");
    for (const token of ["<webview", "new BrowserView", "addChildView"]) {
      if (token === "addChildView" && f === pddViewHost) continue;
      assert.ok(!content.includes(token), `${f} must not embed seller content via ${token}`);
    }
  }
  // Renderer must never own a seller view.
  const rendererFiles = ALL.filter((f) => f.includes("renderer"));
  for (const f of rendererFiles) {
    assert.ok(!readFileSync(f, "utf-8").includes("WebContentsView"), f + " renderer must not own WebContentsView");
  }
  // M7 uses WebContentsView owned by Main (per spec §36), not the deprecated BrowserView.
  const viewHost = readFileSync(pddViewHost, "utf-8");
  assert.ok(viewHost.includes("WebContentsView"), "PDD view host uses Main-owned WebContentsView");
  assert.ok(viewHost.includes("addChildView"), "PDD read-only shield is a Main-owned child view");
  const main = readFileSync(join(SRC, "main", "index.ts"), "utf-8");
  assert.ok(main.includes("will-attach-webview"), "main must prevent webview attachment");
});

test("no seller platform URLs introduced anywhere in desktop source", () => {
  const pddNavigationPolicy = join(SRC, "main", "platforms", "pdd", "pdd-navigation-policy.ts");
  for (const f of ALL) {
    const content = readFileSync(f, "utf-8");
    for (const token of ["pinduoduo.com", "yangkeduo.com", "doudian.com", "jd.com", "kuaishou.com", "qianniu.com", "taobao.com", "xianyu.com"]) {
      if (token === "pinduoduo.com" && f === pddNavigationPolicy) continue;
      assert.ok(!content.toLowerCase().includes(token.toLowerCase()), `${f} must not reference seller platform URL ${token}`);
    }
  }
  const pddPolicy = readFileSync(pddNavigationPolicy, "utf-8");
  assert.ok(pddPolicy.includes('PDD_TOP_LEVEL_HOST = "mms.pinduoduo.com"'), "PDD host is limited to the approved exact host constant");
  for (const token of ["yangkeduo.com", "doudian.com", "jd.com", "kuaishou.com", "qianniu.com", "taobao.com", "xianyu.com"]) {
    assert.ok(!pddPolicy.toLowerCase().includes(token.toLowerCase()), "PDD policy must not absorb unrelated platform URLs");
  }
});

test('platform_capability projection is always \"none\"', async () => {
  const { WorkbenchProjectionService } = await import("../dist/main/services/workbench-projection-service.js");
  const vm = new WorkbenchProjectionService({
    revision: () => 0,
    shops: () => [],
    selectedShopId: () => null,
    conversation: () => null,
    suggestion: () => null,
    mode: () => "human_review",
    countdown: () => null,
    sendStatus: () => null,
    takeoverStatus: () => null,
    workerStatus: () => ({ status: "ready" }),
    lastError: () => null,
  }).project();
  assert.equal(vm.platform_capability, "none");
});
