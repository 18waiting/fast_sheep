import { test } from "node:test";
import assert from "node:assert/strict";
import { JsonlDecoder, encodeFrame } from "../dist/index.js";
import { RPC_ERROR_CODES } from "../dist/index.js";

const collect = (opts: { maxFrameBytes?: number } = {}) => {
  const outcomes: unknown[] = [];
  const dec = new JsonlDecoder({ maxFrameBytes: opts.maxFrameBytes, onOutcome: (o) => outcomes.push(o) });
  return { dec, outcomes };
};

test("decoder emits one frame per line", () => {
  const { dec, outcomes } = collect();
  dec.push('{"a":1}\n');
  assert.equal(outcomes.length, 1);
  assert.deepEqual((outcomes[0] as { frame: unknown }).frame, { a: 1 });
});

test("decoder handles multiple frames per chunk", () => {
  const { dec, outcomes } = collect();
  dec.push('{"a":1}\n{"b":2}\n');
  assert.equal(outcomes.length, 2);
});

test("decoder accumulates partial frames across chunks", () => {
  const { dec, outcomes } = collect();
  dec.push('{"a":');
  dec.push('1}\n');
  assert.equal(outcomes.length, 1);
  assert.deepEqual((outcomes[0] as { frame: unknown }).frame, { a: 1 });
});

test("decoder detects malformed JSON without throwing", () => {
  const { dec, outcomes } = collect();
  dec.push("{bad json\n");
  assert.equal(outcomes.length, 1);
  assert.equal((outcomes[0] as { kind: string }).kind, "malformed");
});

test("decoder enforces max frame size on complete lines", () => {
  const { dec, outcomes } = collect({ maxFrameBytes: 16 });
  dec.push(JSON.stringify({ data: "x".repeat(64) }) + "\n");
  assert.equal(outcomes.length, 1);
  assert.equal((outcomes[0] as { kind: string }).kind, "oversize");
});

test("decoder bounds partial lines that exceed max frame size", () => {
  const { dec, outcomes } = collect({ maxFrameBytes: 8 });
  dec.push("x".repeat(32)); // no newline
  assert.equal(outcomes.length, 1);
  assert.equal((outcomes[0] as { kind: string }).kind, "oversize");
  assert.equal((dec as unknown as { buffer: string }).buffer, "");
});

test("encodeFrame produces a newline-terminated line and enforces size", () => {
  const line = encodeFrame({ a: 1 });
  assert.ok(line.endsWith("\n"));
  assert.throws(() => encodeFrame({ data: "x".repeat(2048) }, 16), (e: unknown) => (e as { code?: string }).code === RPC_ERROR_CODES.FRAME_TOO_LARGE);
});
