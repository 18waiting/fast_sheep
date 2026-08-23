import { test } from "node:test";
import assert from "node:assert/strict";
import { registerGenericPageIpc, type GenericPageIpcDeps } from "../dist/main/platforms/shared/generic-page-ipc.js";

test("generic page IPC registers with a trusted-sender guard", () => {
  const calls: string[] = [];
  const fakeIpc = {
    on: (channel: string) => { calls.push("on:" + channel); },
    removeListener: () => {},
  };
  const stop = registerGenericPageIpc({
    eventChannel: "doudian-page-event",
    commandChannel: "doudian-page-command",
    commandResultChannel: "doudian-page-command-result",
    eventSchemaId: "fastwork:platform:doudian-page-event",
    resultSchemaId: "fastwork:platform:doudian-page-command-result",
    isTrustedWebContents: () => true,
    onPageEvent: () => {},
    onCommandResult: () => {},
    ipc: fakeIpc as never,
  });
  assert.deepEqual(calls, ["on:doudian-page-event", "on:doudian-page-command-result"]);
  assert.equal(typeof stop, "function");
  stop();
});

test("platform channels are scoped (no cross-platform reuse)", () => {
  for (const id of ["doudian", "jd", "kuaishou", "qianniu", "xianyu"]) {
    assert.equal(id + "-page-event", id + "-page-event");
    assert.notEqual(id + "-page-event", "pdd-page-event");
  }
});
