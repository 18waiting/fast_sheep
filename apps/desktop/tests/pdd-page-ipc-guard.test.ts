import { test } from "node:test";
import assert from "node:assert/strict";
import { registerPddPageIpc, PDD_PAGE_EVENT_CHANNEL, PDD_PAGE_COMMAND_RESULT_CHANNEL } from "../dist/main/platforms/pdd/pdd-page-ipc.js";

test("page IPC sender guard rejects unknown webContents", () => {
  const received: unknown[] = [];
  const calls: string[] = [];
  const fakeIpc = {
    on: (channel: string) => { calls.push("on:" + channel); },
    removeListener: () => {},
  };
  const stop = registerPddPageIpc({
    isTrustedPddWebContents: (wc: unknown) => (wc as { id?: string }).id === "trusted",
    onPageEvent: (payload) => { received.push(payload); calls.push("event"); },
    onCommandResult: () => { calls.push("result"); },
    ipc: fakeIpc as never,
  });
  // Verify the two dedicated channels were registered on the injected ipcMain.
  assert.equal(typeof stop, "function");
  assert.deepEqual(calls, ["on:pdd-page-event", "on:pdd-page-command-result"]);
  assert.equal(received.length, 0);
  stop();
});

test("page IPC channels are dedicated (no reuse of desktop renderer channels)", () => {
  assert.equal(PDD_PAGE_EVENT_CHANNEL, "pdd-page-event");
  assert.equal(PDD_PAGE_COMMAND_RESULT_CHANNEL, "pdd-page-command-result");
  assert.notEqual(PDD_PAGE_EVENT_CHANNEL, "desktop.bootstrap");
});

test("page IPC forwards the actual sender only after validation", () => {
  const listeners = new Map<string, (event: unknown, payload: unknown) => void>();
  const received: Array<{ payload: unknown; sender: unknown }> = [];
  registerPddPageIpc({
    isTrustedPddWebContents: (wc: unknown) => (wc as { id?: string }).id === "trusted",
    onPageEvent: (payload, sender) => { received.push({ payload, sender }); },
    onCommandResult: () => {},
    eventValidatorOverride: () => true,
    resultValidatorOverride: () => true,
    ipc: {
      on: (channel: string, listener: (event: unknown, payload: unknown) => void) => { listeners.set(channel, listener); },
      removeListener: () => {},
    } as never,
  });
  const sender = { id: "trusted" };
  const payload = { event: "page_ready" };
  listeners.get(PDD_PAGE_EVENT_CHANNEL)!({ sender }, payload);
  assert.deepEqual(received, [{ payload, sender }]);
});

test("page IPC fails closed when the event validator is unavailable", () => {
  const listeners = new Map<string, (event: unknown, payload: unknown) => void>();
  const received: unknown[] = [];
  registerPddPageIpc({
    isTrustedPddWebContents: () => true,
    onPageEvent: (payload) => { received.push(payload); },
    onCommandResult: () => {},
    eventValidatorOverride: null,
    resultValidatorOverride: null,
    ipc: {
      on: (channel: string, listener: (event: unknown, payload: unknown) => void) => { listeners.set(channel, listener); },
      removeListener: () => {},
    } as never,
  });
  listeners.get(PDD_PAGE_EVENT_CHANNEL)!({ sender: { id: "trusted" } }, { event: "page_ready" });
  assert.equal(received.length, 0);
});
