import { test } from "node:test";
import type { WorkbenchApiLike } from "../dist/renderer/state/workbench-store.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JOB_STATE_LABELS } from "../dist/renderer/components/m10-panel-types.js";

const RENDERER = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "components");

const PANELS = ["background-jobs-panel.ts", "learning-panel.ts", "review-panel.ts", "audit-panel.ts", "product-optimization-panel.ts"];

test("M10 renderer panels are projection/control only (no mutation/provider/sqlite/raw IPC)", () => {
  for (const name of PANELS) {
    const c = readFileSync(join(RENDERER, name), "utf-8");
    for (const token of ["innerHTML", "knowledge_candidates", "knowledge_entries", "INSERT INTO", "UPDATE products", "sqlite", "ipcRenderer", "provider.propose", "require("]) {
      assert.ok(!c.includes(token), name + " must not use " + token);
    }
  }
});

test("app-shell mounts all five M10 panels", () => {
  const shell = readFileSync(join(RENDERER, "app-shell.ts"), "utf-8");
  for (const name of PANELS) {
    assert.ok(shell.includes(name.replace(".ts", "")), "app-shell must import " + name);
    assert.ok(shell.includes("render" + panelName(name)), "app-shell must render " + name);
  }
});

function panelName(file: string): string {
  if (file.startsWith("background-jobs")) return "BackgroundJobsPanel";
  if (file.startsWith("learning")) return "LearningPanel";
  if (file.startsWith("review")) return "ReviewPanel";
  if (file.startsWith("audit")) return "AuditPanel";
  return "ProductOptimizationPanel";
}

test("job state labels are display-only and cover all canonical states", () => {
  for (const s of ["QUEUED", "RUNNING", "CANCELLING", "COMPLETED", "FAILED", "CANCELLED"]) {
    assert.ok(typeof JOB_STATE_LABELS[s] === "string", s);
  }
});

test("renderer store forwards M10 controls to typed IPC commands only", async () => {
const { WorkbenchStore } = await import("../dist/renderer/state/workbench-store.js");
  const calls: string[] = [];
  const api: WorkbenchApiLike = {
    bootstrap: async () => ({ ok: true, data: { revision: 1, worker_status: { status: "ready" }, shops: [], view_model: { revision: 1, shop_summaries: [], worker_status: { status: "ready" }, platform_capability: "none" } } }),
    getSnapshot: async () => ({ ok: true, data: { revision: 1, shop_summaries: [], worker_status: { status: "ready" }, platform_capability: "none" } }),
    setMode: async () => ({ ok: true, data: { ok: true } }),
    manualSend: async () => ({ ok: true, data: { ok: true } }),
    noSaveSend: async () => ({ ok: true, data: { ok: true } }),
    cancel: async () => ({ ok: true, data: { ok: true } }),
    focus: async () => ({ ok: true, data: { ok: true } }),
    onOrchestratorEvent: () => () => {},
    onWorkerStatusChanged: () => () => {},
    onShopsChanged: () => () => {},
    getPlatformStatus: async () => ({ ok: true, data: { shop_id: "s1", platform: "pdd", session_status: "READY", view_visible: true } }),
    activatePlatformShop: async () => ({ ok: true, data: { ok: true } }),
    setPlatformViewBounds: async () => ({ ok: true, data: { ok: true } }),
    reloadPlatform: async () => ({ ok: true, data: { ok: true } }),
    onPlatformStatusChanged: () => () => {},
    listJobs: async () => { calls.push("listJobs"); return { ok: true, data: { jobs: [{ job_id: "j1", type: "learning", state: "COMPLETED", progress: 100, message: "" }] } }; },
    startLearning: async (req) => { calls.push("startLearning:" + req.import_source); return { ok: true, data: { job_id: "j1", ok: true } }; },
    reviewAction: async (req) => { calls.push("reviewAction:" + req.action); return { ok: true, data: { ok: true } }; },
    auditAction: async (req) => { calls.push("auditAction:" + req.action); return { ok: true, data: { ok: true } }; },
    optimizationAction: async (req) => { calls.push("optimizationAction:" + req.action); return { ok: true, data: { ok: true } }; },
    cancelJob: async (req) => { calls.push("cancelJob:" + req.job_id); return { ok: true, data: { ok: true } }; },
    onJobsChanged: () => () => {},
    onLearningChanged: () => () => {},
    onReviewChanged: () => () => {},
    onAuditChanged: () => () => {},
    onOptimizationChanged: () => () => {},
  };
  const store = new WorkbenchStore(api);
  await store.startLearning("chat.txt");
  await store.reviewAction("propose");
  await store.auditAction("保留");
  await store.optimizationAction("apply", "10001", "详情");
  await store.cancelJob("j1");
  assert.ok(calls.includes("startLearning:chat.txt"));
  assert.ok(calls.includes("reviewAction:propose"));
  assert.ok(calls.includes("auditAction:保留"));
  assert.ok(calls.includes("optimizationAction:apply"));
  assert.ok(calls.includes("cancelJob:j1"));
  const m10 = store.getState().m10;
  assert.ok(m10 && m10.jobs.length >= 1);
});
