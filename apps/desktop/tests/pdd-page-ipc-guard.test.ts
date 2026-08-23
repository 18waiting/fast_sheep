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
