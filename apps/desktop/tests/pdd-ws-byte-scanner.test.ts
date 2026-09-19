import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync, gunzipSync, deflateSync, gzipSync } from "node:zlib";

// Mirrors the harness WS byte scanner exactly.
function scanFrame(payloadData, opcode, labels) {
  const raw = opcode === 1 ? Buffer.from(payloadData, "utf8") : Buffer.from(payloadData, "base64");
  const variants = [raw];
  try { variants.push(inflateSync(raw)); } catch {}
  try { variants.push(gunzipSync(raw)); } catch {}
  const hits = new Set();
  for (const buf of variants) {
    const t = buf.toString("utf8"); const l = buf.toString("latin1");
    for (const label of labels) if (t.includes(label) || l.includes(label)) hits.add(label);
  }
  return { variants: variants.length, hits: [...hits] };
}

const LABELS = ["FS-PROBE-1", "FS-C1", "FS-C6"];

test("scanner hits a label in a plain binary frame", () => {
  const r = scanFrame(Buffer.from('{"content":"FS-PROBE-1"}').toString("base64"), 2, LABELS);
  assert.deepEqual(r.hits, ["FS-PROBE-1"]);
});

test("scanner hits a label inside a deflate-compressed binary frame", () => {
  const r = scanFrame(deflateSync(Buffer.from('x FS-PROBE-1 y')).toString("base64"), 2, LABELS);
  assert.deepEqual(r.hits, ["FS-PROBE-1"], "inflate attempt must recover the label");
});

test("scanner hits a label inside a gzip-compressed binary frame", () => {
  const r = scanFrame(gzipSync(Buffer.from('x FS-C6 y')).toString("base64"), 2, LABELS);
  assert.deepEqual(r.hits, ["FS-C6"], "gunzip attempt must recover the label");
});

test("scanner hits a label in a plain text frame", () => {
  const r = scanFrame('{"content":"FS-C1"}', 1, LABELS);
  assert.deepEqual(r.hits, ["FS-C1"]);
});

test("scanner reports no hits when the label is genuinely absent (and never throws)", () => {
  const r = scanFrame(Buffer.from([0x00, 0x0a, 0x00, 0x66, 0xff, 0xfe]).toString("base64"), 2, LABELS);
  assert.deepEqual(r.hits, []);
  assert.ok(r.variants >= 1);
});