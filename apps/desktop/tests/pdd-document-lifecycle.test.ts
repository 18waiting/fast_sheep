import { test } from "node:test";
import assert from "node:assert/strict";
import { bindPddDocumentLifecycle } from "../dist/main/platforms/pdd/pdd-document-lifecycle.js";

class FakeWebContents {
  private readonly listeners = new Map<string, (...args: unknown[]) => void>();
  on(event: string, listener: (...args: unknown[]) => void): this {
    this.listeners.set(event, listener);
    return this;
  }
  emit(event: string, ...args: unknown[]): void { this.listeners.get(event)?.(...args); }
}

test("PDD lifecycle accepts only main-frame new-document navigation", () => {
  const source = new FakeWebContents();
  const calls: string[] = [];
  bindPddDocumentLifecycle(source, {
    onMainFrameNavigationStart: () => calls.push("navigation"),
    onMainFrameDomReady: () => calls.push("dom-ready"),
    onMainFrameLoadFailure: () => calls.push("failure"),
  });

  source.emit("did-start-navigation", {}, "https://mms.pinduoduo.com/chat/", true, true);
  source.emit("did-start-navigation", {}, "https://mms.pinduoduo.com/chat/", false, false);
  source.emit("did-start-navigation", {}, "https://mms.pinduoduo.com/chat/", false, true);
  source.emit("dom-ready");
  source.emit("did-fail-load", {}, -2, "failed", "https://mms.pinduoduo.com/chat/", true);
  source.emit("did-fail-load", {}, -2, "failed", "https://mms.pinduoduo.com/chat/", false);
  source.emit("render-process-gone", {}, { reason: "crashed" });

  assert.deepEqual(calls, ["navigation", "dom-ready", "failure", "failure"]);
});
