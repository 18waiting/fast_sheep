import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCountdown } from "../dist/renderer/components/countdown-view.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

test("countdown formatting is display-only and deterministic", () => {
  assert.equal(formatCountdown(5, 1000), "00:05");
  assert.equal(formatCountdown(60, 1000), "01:00");
  assert.equal(formatCountdown(0, 1000), "00:00");
  assert.equal(formatCountdown(3, 500), "00:02");
});

test("visual zero alone can never send from the renderer", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "components", "countdown-view.ts"), "utf-8");
  // The countdown component is a pure projection; it must not reference any send path.
  for (const token of ["manualSend", "noSaveSend", "onCountdownElapsed", "sendText", "actions.onManualSend"]) {
    assert.ok(!src.includes(token), "countdown view must not trigger " + token);
  }
});
