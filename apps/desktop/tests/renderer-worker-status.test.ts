import { test } from "node:test";
import assert from "node:assert/strict";
import { workerStatusLabel } from "../dist/renderer/components/worker-status-badge.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

test("worker status badge renders only safe lifecycle statuses", () => {
  assert.equal(workerStatusLabel("ready"), "就绪");
  assert.equal(workerStatusLabel("starting"), "启动中");
  assert.equal(workerStatusLabel("restarting"), "重启中");
  assert.equal(workerStatusLabel("stopped"), "已停止");
  assert.equal(workerStatusLabel("error"), "错误");
});

test("unknown status falls back to the raw safe status string (no crash)", () => {
  assert.equal(workerStatusLabel("weird"), "weird");
});

test("worker status component never projects internal worker details", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "components", "worker-status-badge.ts"), "utf-8");
  for (const token of ["process.stderr", "python_path", "process.env", "credential_ref", "api_key"]) {
    assert.ok(!src.includes(token), "worker badge must not expose " + token);
  }
});
