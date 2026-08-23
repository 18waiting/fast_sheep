// Test harness helpers for @fastwork/worker-rpc tests (TASK-017 M2).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AIWorkerClient } from "../../dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const FAKE_WORKER = join(HERE, "fake-worker.mjs");

export function spawnFakeClient(opts = {}) {
  return new AIWorkerClient({
    spawn: { executable: process.execPath, args: [FAKE_WORKER], cwd: join(HERE, "..") },
    env: { FAKE_WORKER_MODE: opts.mode ?? "normal", ...(opts.env ?? {}) },
    maxFrameBytes: opts.maxFrameBytes,
    maxInFlight: opts.maxInFlight,
    maxQueuedFrames: opts.maxQueuedFrames,
    startupTimeoutMs: opts.startupTimeoutMs ?? 5000,
    requestTimeoutMs: opts.requestTimeoutMs ?? 3000,
    gracefulShutdownTimeoutMs: opts.gracefulShutdownTimeoutMs ?? 2000,
    restart: opts.restart,
    sleepMs: opts.sleepMs,
    requestIdFactory: opts.requestIdFactory,
  });
}

export async function startReady(opts = {}) {
  const client = spawnFakeClient(opts);
  await client.start();
  return client;
}

export async function waitForState(client, expected, timeoutMs = 4000) {
  const start = Date.now();
  while (client.state() !== expected) {
    if (Date.now() - start > timeoutMs) throw new Error("timeout waiting for state " + expected + " (got " + client.state() + ")");
    await new Promise((r) => setTimeout(r, 10));
  }
}

export async function waitForPending(client, expected = 0, timeoutMs = 4000) {
  const start = Date.now();
  while (client.pendingCount !== expected) {
    if (Date.now() - start > timeoutMs) throw new Error("timeout waiting for pending " + expected + " (got " + client.pendingCount + ")");
    await new Promise((r) => setTimeout(r, 10));
  }
}

export async function stopIfRunning(client) {
  if (client.state() !== "STOPPED") {
    try { await client.stop(); } catch { /* ignore */ }
  }
}
