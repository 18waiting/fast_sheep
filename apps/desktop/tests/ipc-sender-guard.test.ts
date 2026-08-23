import { test } from "node:test";
import assert from "node:assert/strict";
import { IpcGuard } from "../dist/main/ipc/ipc-guard.js";
import { IPC, DesktopError, DESKTOP_ERROR_CODES } from "@fastwork/desktop-ipc";

function makeGuard(trusted = true) {
  return new IpcGuard({ sender: () => ({ isTrustedWindow: trusted }) });
}

test("unknown channel -> desktop.not_found", async () => {
  const g = makeGuard();
  const res = await g.guard("totally.unknown", () => ({ ok: true }))({});
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error.code, DESKTOP_ERROR_CODES.NOT_FOUND);
});

test("untrusted sender -> desktop.forbidden_sender", async () => {
  const g = makeGuard(false);
  const res = await g.guard(IPC.manualSend, () => ({ ok: true }))({ shop_id: "s1", conversation_id: "c1" });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error.code, DESKTOP_ERROR_CODES.FORBIDDEN_SENDER);
});

test("invalid set_mode payload -> desktop.invalid_request", async () => {
  const g = makeGuard();
  const res = await g.guard(IPC.setMode, () => ({ ok: true }))({ shop_id: "s1", mode: "invalid_mode" });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error.code, DESKTOP_ERROR_CODES.INVALID_REQUEST);
});

test("valid command request passes validation and returns ok", async () => {
  const g = makeGuard();
  const res = await g.guard(IPC.setMode, () => ({ ok: true, data: { ok: true } }))({ shop_id: "s1", conversation_id: "c1", mode: "full_auto" });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.data.ok, true);
});

test("DesktopError from handler is surfaced with its code", async () => {
  const g = makeGuard();
  const res = await g.guard(IPC.manualSend, () => {
    throw new DesktopError(DESKTOP_ERROR_CODES.WORKER_UNAVAILABLE, "worker unavailable");
  })({ shop_id: "s1", conversation_id: "c1" });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error.code, DESKTOP_ERROR_CODES.WORKER_UNAVAILABLE);
});

test("generic handler exception -> desktop.command_failed (no raw error leak)", async () => {
  const g = makeGuard();
  const res = await g.guard(IPC.manualSend, () => {
    throw new Error("SECRET_PATH=C:/Users/secret/worker.log");
  })({ shop_id: "s1", conversation_id: "c1" });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, DESKTOP_ERROR_CODES.COMMAND_FAILED);
    assert.doesNotMatch(res.error.message, /SECRET_PATH/);
  }
});

test("response validation rejects invalid bootstrap payload", async () => {
  const g = makeGuard();
  const res = await g.guard(IPC.bootstrap, () => ({ ok: true, data: { not_the_right_shape: true } }))();
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error.code, DESKTOP_ERROR_CODES.COMMAND_FAILED);
});
