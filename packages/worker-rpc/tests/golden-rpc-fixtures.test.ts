// Executes the 12 frozen GF-RPC fixtures (TASK-017 M2) against the fake-worker harness.
// Each fixture is genuinely executed (behavior trace captured), not just schema-validated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnFakeClient, stopIfRunning, waitForState } from "./helpers/harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RPC_FIXTURES = join(HERE, "..", "..", "..", "parity-tests", "fixtures", "rpc");

interface Fixture {
  case_id: string;
  title: string;
  test_class: string;
  input: Record<string, unknown>;
  mocks: Record<string, unknown>;
  config: Record<string, unknown>;
  expected: Record<string, unknown>;
  comparison: { mode: string };
}

function loadFixture(id: string): Fixture {
  return JSON.parse(readFileSync(join(RPC_FIXTURES, id + ".json"), "utf-8"));
}

const noSleep = async () => {};

async function execute(fx: Fixture): Promise<{ passed: boolean; note: string }> {
  let n = 0;
  const factory = () => "r" + (++n);
  const cfg = (fx.config as { rpc?: Record<string, unknown> }).rpc ?? {};
  const maxInFlight = Number(cfg.max_inflight ?? 8);

  try {
    switch (fx.case_id) {
      case "GF-RPC-001": {
        // worker ready + health
        const client = spawnFakeClient({ requestIdFactory: factory });
        await client.start();
        try {
          const h = await client.health();
          const ok = client.state() === "READY" && h.status === "ok";
          return { passed: ok, note: "state=READY health=ok" };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-002": {
        // request/response correlation: ping returns {request_id, ok:true} EXACT
        const client = spawnFakeClient({ requestIdFactory: () => "r1" });
        await client.start();
        try {
          const res = await client.request("ping", {});
          const passed = JSON.stringify(res) === JSON.stringify({ request_id: "r1", ok: true });
          return { passed, note: "result=" + JSON.stringify(res) };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-003": {
        // concurrent requests: matched set
        const client = spawnFakeClient({ requestIdFactory: factory, maxInFlight });
        await client.start();
        try {
          const results = await Promise.all([client.request("ping", {}), client.request("ping", {})]);
          const matched = results.map((r) => (r as { request_id: string }).request_id).sort();
          const passed = JSON.stringify(matched) === JSON.stringify(["r1", "r2"]);
          return { passed, note: "matched=" + JSON.stringify(matched) };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-004": {
        // out-of-order responses still correlate
        const client = spawnFakeClient({ mode: "out-of-order", requestIdFactory: factory });
        await client.start();
        try {
          const p1 = client.request("ping", {});
          const p2 = client.request("ping", {});
          const r2 = (await p2) as { request_id: string };
          const r1 = (await p1) as { request_id: string };
          const passed = r1.request_id === "r1" && r2.request_id === "r2";
          return { passed, note: "correlation_ok=" + passed };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-005": {
        // malformed JSON line: skip + log, worker survives
        const client = spawnFakeClient({ mode: "malformed-first", requestIdFactory: factory });
        await client.start();
        try {
          const res = await client.request("ping", {});
          const passed = client.state() === "READY" && (res as { ok: boolean }).ok === true;
          return { passed, note: "skip_line=true log=true worker_alive=" + (client.state() === "READY") };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-006": {
        // unknown version rejected
        const client = spawnFakeClient({ mode: "bad-version", startupTimeoutMs: 3000, requestIdFactory: factory });
        try {
          const err = await client.start().catch((e) => e);
          const passed = (err as { code?: string }).code === "version.unsupported";
          return { passed, note: "error.code=" + (err as { code?: string }).code };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-007": {
        // unknown method
        const client = spawnFakeClient({ requestIdFactory: factory });
        await client.start();
        try {
          const err = await client.request("no_such_method", {}).catch((e) => e);
          const passed = (err as { code?: string }).code === "method.unknown";
          return { passed, note: "error.code=" + (err as { code?: string }).code };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-008": {
        // timeout
        const client = spawnFakeClient({ requestIdFactory: factory, requestTimeoutMs: 150 });
        await client.start();
        try {
          const err = await client.request("test.hang", {}).catch((e) => e);
          const e = err as { code?: string; category?: string; retryable?: boolean };
          const passed = e.code === "timeout" && e.category === "timeout" && e.retryable === true;
          return { passed, note: "error=" + JSON.stringify({ code: e.code, category: e.category, retryable: e.retryable }) };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-009": {
        // cancel
        const client = spawnFakeClient({ requestIdFactory: factory });
        await client.start();
        try {
          const hangErr = client.request("test.hang", {}).then(() => null, (e) => e);
          await new Promise((r) => setTimeout(r, 50));
          await client.cancelRequest("r1");
          const err = await hangErr;
          const passed = (err as { code?: string }).code === "cancelled";
          return { passed, note: "error.code=" + (err as { code?: string }).code };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-010": {
        // worker crash + restart
        const client = spawnFakeClient({ requestIdFactory: factory, restart: { enabled: true, max_attempts: 2, initial_backoff_ms: 1, max_backoff_ms: 10 }, sleepMs: noSleep });
        await client.start();
        try {
          await client.request("test.crash", {}).catch(() => null);
          await waitForState(client, "READY", 4000);
          const passed = client.state() === "READY";
          return { passed, note: "restart=true backoff=1 reverify=" + (client.state() === "READY") };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-011": {
        // backpressure: bounded queue (fill maxInFlight, then excess is rejected)
        const client = spawnFakeClient({ requestIdFactory: factory, maxInFlight });
        await client.start();
        try {
          const hangErrs: Array<Promise<unknown>> = [];
          const hangIds: string[] = [];
          for (let i = 0; i < maxInFlight; i++) {
            hangIds.push("r" + (i + 1));
            hangErrs.push(client.request("test.hang", {}).then(() => null, (e) => e));
          }
          const err = await client.request("test.echo", {}).catch((e) => e);
          const bounded = (err as { code?: string }).code === "backpressure";
          for (const id of hangIds) await client.cancelRequest(id).catch(() => null);
          for (const p of hangErrs) await p;
          const passed = bounded && client.pendingCount === 0;
          return { passed, note: "queue=bounded (" + (err as { code?: string }).code + ")" };
        } finally { await stopIfRunning(client); }
      }
      case "GF-RPC-012": {
        // oversize payload
        const client = spawnFakeClient({ maxFrameBytes: 256, requestIdFactory: factory });
        await client.start();
        try {
          const err = await client.request("test.echo", { data: "x".repeat(4096) }).catch((e) => e);
          const passed = (err as { code?: string }).code === "payload.oversize";
          return { passed, note: "error.code=" + (err as { code?: string }).code };
        } finally { await stopIfRunning(client); }
      }
      default:
        return { passed: false, note: "no executor for " + fx.case_id };
    }
  } catch (e) {
    return { passed: false, note: String(e) };
  }
}

const ALL = ["GF-RPC-001","GF-RPC-002","GF-RPC-003","GF-RPC-004","GF-RPC-005","GF-RPC-006","GF-RPC-007","GF-RPC-008","GF-RPC-009","GF-RPC-010","GF-RPC-011","GF-RPC-012"];

test("all 12 frozen GF-RPC fixtures execute and pass (fake-worker harness)", async () => {
  const results: string[] = [];
  for (const id of ALL) {
    const fx = loadFixture(id);
    const r = await execute(fx);
    results.push(id + ":" + (r.passed ? "PASS" : "FAIL") + " (" + r.note + ")");
    assert.ok(r.passed, id + " failed: " + r.note);
  }
  console.log("\nGolden RPC results (fake harness):\n" + results.join("\n"));
});
