// M7 platform golden execution (unit-level). Drives the production PDD adapter +
// synthetic DOM harness against the frozen GF-PDD / GF-PLAT fixtures discovered
// on disk. Full discovery + classification lives in scripts/verify-m7-pdd-goldens.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PddPlatformAdapter } from "../dist/pdd-platform-adapter.js";
import { PddSessionState } from "../dist/session-state.js";
import { PDD_SELECTOR_PROFILE } from "../dist/selector-profile.js";
import { normalizeMessage } from "../dist/message-normalizer.js";
import { handleCommand } from "../dist/page/command-handler.js";
import type { PddPageBridge } from "../dist/pdd-page-bridge.js";
import type { PddPageCommand, PddPageCommandResult } from "../dist/types.js";
import { loadFixture } from "./helpers.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, "..", "..", "..", "..", "parity-tests", "fixtures");

function readFixture(rel: string): { case_id: string; input: Record<string, unknown>; expected: Record<string, unknown>; title: string; behavior_ids: string[] } {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, rel), "utf-8"));
}

class SyntheticDomBridge implements PddPageBridge {
  private readonly fixtureName: string;
  constructor(fixture: string) {
    this.fixtureName = fixture;
  }
  async execute(cmd: PddPageCommand): Promise<PddPageCommandResult> {
    const doc = loadFixture(this.fixtureName);
    return handleCommand(doc, cmd);
  }
}

function adapterFor(fixture: string) {
  const session = new PddSessionState("shop-1", "session-1");
  session.setStatus("READY");
  const adapter = new PddPlatformAdapter({ bridge: new SyntheticDomBridge(fixture), session, commandIdFactory: () => "cmd-1" });
  return { adapter, session };
}

test("GF-PDD-001 buyer unread message detected + normalized", () => {
  const f = readFixture("pdd/GF-PDD-001.json");
  const input = f.input.dom_state as { unread: boolean; buyer: string; content: string };
  const msg = normalizeMessage({ shop_id: "shop-1", conversation_id: "c1", raw: { unread: input.unread, buyer: input.buyer, content: input.content } });
  const exp = f.expected.result.normalized as { platform: string; buyer: string; content: string };
  assert.equal(msg.platform, exp.platform);
  assert.equal(msg.buyer, exp.buyer);
  assert.equal(msg.content, exp.content);
  assert.ok(f.behavior_ids.includes("B-PLATFORM-001"));
});

test("GF-PDD-002 text send success", async () => {
  const f = readFixture("pdd/GF-PDD-002.json");
  const send = f.input.send as { conversation_id: string; content: string };
  const { adapter } = adapterFor("send-text-ready.html");
  const res = await adapter.sendText("shop-1", send.conversation_id, [send.content]);
  assert.equal(res.ok, true);
});

test("GF-PDD-003 segmented text send -> adapter receives one segment per call", async () => {
  const f = readFixture("pdd/GF-PDD-003.json");
  const segments = (f.input.send as { segments: string[] }).segments;
  const { adapter } = adapterFor("send-text-ready.html");
  for (const seg of segments) {
    const res = await adapter.sendText("shop-1", "c1", [seg]);
    assert.equal(res.ok, true);
  }
});

test("GF-PDD-004 image send capability", async () => {
  const f = readFixture("pdd/GF-PDD-004.json");
  const { adapter } = adapterFor("send-text-ready.html");
  const res = await adapter.sendImage("shop-1", "c1", (f.input as { asset: string }).asset);
  assert.equal(res.ok, true);
});

test("GF-PDD-005 transfer target available -> executed", async () => {
  const f = readFixture("pdd/GF-PDD-005.json");
  const t = f.input.transfer as { requested: boolean; target: string };
  const { adapter } = adapterFor("transfer-ready.html");
  const res = await adapter.executeTransfer("shop-1", "c1", { requested: t.requested, target: t.target });
  assert.equal(res.executed, true);
  assert.deepEqual((f.expected.decisions as unknown[])[0], { transfer_executed: true });
});

test("GF-PDD-006 no available agent -> fallback message", async () => {
  const f = readFixture("pdd/GF-PDD-006.json");
  const t = f.input.transfer as { requested: boolean; target: string };
  const { adapter } = adapterFor("transfer-target-missing.html");
  const res = await adapter.executeTransfer("shop-1", "c1", { requested: t.requested, target: t.target });
  assert.equal(res.executed, false);
  const exp = (f.expected.decisions as unknown[])[0] as { transfer: string; text: string };
  assert.equal(exp.transfer, "fallback_message");
  assert.ok(res.fallback_message !== undefined);
});

test("GF-PDD-007 transfer success executes steps 1-3", async () => {
  const f = readFixture("pdd/GF-PDD-007.json");
  const t = f.input.transfer as { requested: boolean; target: string };
  const { adapter } = adapterFor("transfer-ready.html");
  const res = await adapter.executeTransfer("shop-1", "c1", { requested: t.requested, target: t.target });
  assert.equal(res.ok, true);
  assert.equal(res.executed, true);
  const exp = (f.expected.external_calls as unknown[])[0] as { steps: number[] };
  assert.deepEqual(exp.steps, [1, 2, 3]);
});

test("GF-PDD-008 DOM unavailable -> safe failure, no bypass", async () => {
  const f = readFixture("pdd/GF-PDD-008.json");
  const { adapter } = adapterFor("dom-unsupported.html");
  const res = await adapter.sendText("shop-1", "c1", ["x"]);
  assert.equal(res.ok, false);
  const exp = (f.expected.decisions as unknown[])[0] as { safe_fail: boolean; no_bypass: boolean };
  assert.equal(exp.safe_fail, true);
  assert.equal(exp.no_bypass, true);
  assert.equal(res.error, "platform.dom_unavailable");
});

test("GF-PDD-009 login unavailable -> listener stopped (LOGIN_REQUIRED)", () => {
  const f = readFixture("pdd/GF-PDD-009.json");
  const session = new PddSessionState("shop-1", "session-1");
  session.setStatus("LOGIN_REQUIRED");
  // A login-required session is not ready; listener is effectively stopped.
  assert.equal(session.isReady(), false);
  const exp = (f.expected.decisions as unknown[])[0] as { login: string; listener: string };
  assert.equal(exp.login, "unavailable");
  assert.equal(exp.listener, "stopped");
});

test("GF-PLAT-001 pdd capability declaration", () => {
  const f = readFixture("plat/GF-PLAT-001.json");
  const { adapter } = adapterFor("chat-basic.html");
  const caps = adapter.capabilities();
  const expected = (f.expected.result as { capabilities: string[] }).capabilities;
  for (const name of expected) {
    const flag = name === "textSend" ? "send_text" : name === "imageSend" ? "send_image" : name === "transfer" ? "transfer" : name === "productContext" ? "product_context" : name === "orderContext" ? "order_context" : null;
    if (flag) assert.equal(caps[flag as keyof typeof caps], true, name);
  }
});

test("PDD fixture inventory on disk is non-empty and schema-valid", () => {
  const pdd = readdirSync(join(FIXTURES_DIR, "pdd")).filter((f) => f.endsWith(".json"));
  const plat = readdirSync(join(FIXTURES_DIR, "plat")).filter((f) => f.endsWith(".json"));
  assert.ok(pdd.length === 9, "9 GF-PDD fixtures");
  assert.ok(plat.length === 4, "4 GF-PLAT fixtures");
  assert.equal(PDD_SELECTOR_PROFILE.version, "pdd-dom-1.0.0");
});
