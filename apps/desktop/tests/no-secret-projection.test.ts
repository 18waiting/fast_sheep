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

test("renderer/preload source never references secret-bearing keys", () => {
  const files = listFiles(SRC).filter((f) => f.includes("renderer") || f.includes("preload"));
  const forbidden = ["api_key", "apiKey", "credential_ref", "client_secret", "access_token", "token_value", "SecretStore", "provider_api_key"];
  for (const f of files) {
    const content = readFileSync(f, "utf-8");
    for (const token of forbidden) {
      assert.ok(!content.includes(token), `${f} must not reference secret key ${token}`);
    }
  }
});

test('main projection service only emits configured/not-configured flags, never credentials', async () => {
  const { WorkbenchProjectionService } = await import("../dist/main/services/workbench-projection-service.js");
  const vm = new WorkbenchProjectionService({
    revision: () => 1,
    shops: () => [{ shop_id: "s1", name: "n", type: "pdd", enabled: true }],
    selectedShopId: () => "s1",
    conversation: () => ({ conversation_id: "c1", shop_id: "s1", state: "idle" }),
    suggestion: () => null,
    mode: () => "human_review",
    countdown: () => null,
    sendStatus: () => null,
    takeoverStatus: () => null,
    workerStatus: () => ({ status: "ready" }),
    lastError: () => null,
  }).project();
  const json = JSON.stringify(vm);
  for (const token of ["api_key", "secret", "credential", "token", "auth"]) {
    assert.ok(!json.toLowerCase().includes(token), "view model must not contain " + token);
  }
});
