import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PddPlatformAdapter } from "../dist/pdd-platform-adapter.js";
import { PddSessionState } from "../dist/session-state.js";
import type { PddPageBridge } from "../dist/pdd-page-bridge.js";
import type { PddPageCommand, PddPageCommandResult } from "../dist/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));

class RecordingBridge implements PddPageBridge {
  calls: Array<{ type: string; text?: string; asset_ref?: string; target?: string }> = [];
  private readonly handler: (cmd: PddPageCommand) => PddPageCommandResult;
  constructor(handler: (cmd: PddPageCommand) => PddPageCommandResult) {
    this.handler = handler;
  }
  async execute(cmd: PddPageCommand): Promise<PddPageCommandResult> {
    this.calls.push({ type: cmd.type, text: cmd.text, asset_ref: cmd.asset_ref, target: cmd.target });
    return this.handler(cmd);
  }
}

function makeAdapter(bridge: PddPageBridge) {
  const session = new PddSessionState("shop-1", "session-1");
  session.setStatus("READY");
  const adapter = new PddPlatformAdapter({ bridge, session, commandIdFactory: () => "cmd-1" });
  return { adapter, session };
}

test("sendText sends exactly one already-decided segment (GF-PDD-002)", async () => {
  const bridge = new RecordingBridge((cmd) => ({ command_id: cmd.command_id, ok: true, result: { message_id: "ack-1" } }));
  const { adapter } = makeAdapter(bridge);
  const res = await adapter.sendText("shop-1", "c1", ["亲,有的~"]);
  assert.equal(res.ok, true);
  assert.equal(bridge.calls.length, 1);
  assert.equal(bridge.calls[0].type, "send_text");
  assert.equal(bridge.calls[0].text, "亲,有的~");
});

test("adapter never sees ### as a split request and never sleeps 800ms", async () => {
  const bridge = new RecordingBridge((cmd) => ({ command_id: cmd.command_id, ok: true, result: { message_id: "a" } }));
  const { adapter } = makeAdapter(bridge);
  await adapter.sendText("shop-1", "c1", ["A###B###C"]);
  assert.equal(bridge.calls.length, 1, "one segment per call");
  assert.equal(bridge.calls[0].text, "A###B###C", "no splitting in adapter");

  const src = readFileSync(join(HERE, "..", "src", "pdd-platform-adapter.ts"), "utf-8");
  assert.ok(!src.includes("800"), "no 800ms sleep in adapter");
  assert.ok(!src.includes("setTimeout"), "no sleep in adapter");
  assert.ok(!src.includes("###"), "no ### segmentation logic in adapter");
});

test("three orchestrated segments -> exactly three adapter calls (GF-PDD-003 ownership)", async () => {
  const bridge = new RecordingBridge((cmd) => ({ command_id: cmd.command_id, ok: true, result: { message_id: cmd.command_id } }));
  const { adapter } = makeAdapter(bridge);
  for (const seg of ["A", "B", "C"]) {
    const res = await adapter.sendText("shop-1", "c1", [seg]);
    assert.equal(res.ok, true);
  }
  assert.deepEqual(bridge.calls.map((c) => c.text), ["A", "B", "C"]);
  assert.equal(bridge.calls.length, 3);
});

test("not-ready session returns structured NOT_READY (no DOM access)", async () => {
  const session = new PddSessionState("shop-1", "s");
  const adapter = new PddPlatformAdapter({ bridge: new RecordingBridge(() => ({ command_id: "x", ok: true })), session });
  const res = await adapter.sendText("shop-1", "c1", ["x"]);
  assert.equal(res.ok, false);
  assert.equal(res.error, "platform.not_ready");
});

test("empty segment is a no-op (GF-ORCH-SEG-002: no empty send)", async () => {
  const bridge = new RecordingBridge((cmd) => ({ command_id: cmd.command_id, ok: true }));
  const { adapter } = makeAdapter(bridge);
  const res = await adapter.sendText("shop-1", "c1", [""]);
  assert.equal(res.ok, true);
  assert.equal(bridge.calls.length, 0);
});

test("sendImage maps to the image capability (GF-PDD-004)", async () => {
  const bridge = new RecordingBridge((cmd) => ({ command_id: cmd.command_id, ok: true }));
  const { adapter } = makeAdapter(bridge);
  const res = await adapter.sendImage("shop-1", "c1", "img1");
  assert.equal(res.ok, true);
  assert.equal(bridge.calls[0].type, "send_image");
  assert.equal(bridge.calls[0].asset_ref, "img1");
});

test("executeTransfer consumes explicit TransferDecision only (GF-PDD-005/007)", async () => {
  const bridge = new RecordingBridge((cmd) => ({ command_id: cmd.command_id, ok: true, result: { executed: true } }));
  const { adapter } = makeAdapter(bridge);
  const res = await adapter.executeTransfer("shop-1", "c1", { requested: true, target: "售后" });
  assert.equal(res.ok, true);
  assert.equal(res.executed, true);
  assert.equal(bridge.calls[0].target, "售后");
});

test("no target -> structured no_target; adapter never chooses a target", async () => {
  const bridge = new RecordingBridge((cmd) => ({ command_id: cmd.command_id, ok: true }));
  const { adapter } = makeAdapter(bridge);
  const res = await adapter.executeTransfer("shop-1", "c1", { requested: true });
  assert.equal(res.ok, false);
  assert.equal(res.error, "no_target");
  assert.equal(bridge.calls.length, 0);
});

test("capability query matches the PDD capability declaration (GF-PLAT-001)", () => {
  const { adapter } = makeAdapter(new RecordingBridge(() => ({ command_id: "x", ok: true })));
  const caps = adapter.capabilities();
  assert.equal(caps.send_text, true);
  assert.equal(caps.send_image, true);
  assert.equal(caps.transfer, true);
  assert.equal(caps.product_context, true);
  assert.equal(caps.order_context, true);
  assert.equal(adapter.supports("transfer"), true);
});
