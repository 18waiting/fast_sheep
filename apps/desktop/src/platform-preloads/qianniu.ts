// M8 Qianniu page preload (clean-room). Sandboxed; exposes NOTHING to the seller page.
import { ipcRenderer } from "electron";
import { PlatformPageRuntime, toDomDocument, type PlatformPageCommand, type PlatformPageEvent, type CommandHandlers } from "@fastwork/platform-web-common";
import { QIANNIU_SELECTOR_PROFILE } from "@fastwork/platform-qianniu";
import { qianniuSendText, qianniuExecuteTransfer, qianniuImageDriver } from "@fastwork/platform-qianniu";

function boot(): void {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id") ?? "unknown";
  const shopId = params.get("shop_id") ?? "unknown";
  const doc = toDomDocument(window.document);

  const handlers: CommandHandlers = {
    health: (c) => ({ command_id: c.command_id, ok: true, result: { ready: true } }),
    scan: (c) => ({ command_id: c.command_id, ok: true, result: {} }),
    send_text: (c) => {
      const r = qianniuSendText(doc, c.conversation_id ?? "", c.text ?? "");
      return { command_id: c.command_id, ok: r.ok, result: { message_id: r.message_id } };
    },
    send_image: (c) => {
      const r = qianniuImageDriver(doc, c.conversation_id ?? "", c.asset_ref ?? "");
      return { command_id: c.command_id, ok: r.ok, result: { message_id: r.message_id } };
    },
    transfer: (c) => {
      const r = qianniuExecuteTransfer(doc, c.target ?? "");
      return { command_id: c.command_id, ok: r.ok, result: { executed: r.executed, fallback_message: r.fallback_message } };
    },
    focus_conversation: (c) => ({ command_id: c.command_id, ok: true, result: { conversation_id: c.conversation_id } }),
  };

  const runtime = new PlatformPageRuntime({
    platform: "qianniu",
    doc,
    sessionId,
    shopId,
    profile: QIANNIU_SELECTOR_PROFILE,
    handlers,
    transport: {
      send: (event: PlatformPageEvent) => { ipcRenderer.send("qianniu-page-event", event); },
      onCommand: (handler) => {
        const listener = (_event: unknown, command: PlatformPageCommand): void => {
          const result = handler(command);
          if (result instanceof Promise) void result.then((r) => ipcRenderer.send("qianniu-page-command-result", r));
          else ipcRenderer.send("qianniu-page-command-result", result);
        };
        ipcRenderer.on("qianniu-page-command", listener as never);
        return () => { ipcRenderer.removeListener("qianniu-page-command", listener as never); };
      },
    },
  });
  runtime.start();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
