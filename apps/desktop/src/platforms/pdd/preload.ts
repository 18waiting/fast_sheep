// M7 PDD page preload (clean-room). Runs inside the PDD WebContentsView.
// Security: sandbox=true, contextIsolation=true, nodeIntegration=false.
// Exposes NOTHING to the seller page (no contextBridge call). It only:
//  - observes the page DOM (synthetic contract)
//  - sends schema-validated normalized events to trusted Main
//  - executes finite-allowlist commands from trusted Main
import { ipcRenderer } from "electron";
import { PddPageRuntime, toDomDocument, type PddPageCommand, type PddPageEvent } from "@fastwork/platform-pdd";

function boot(): void {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id") ?? "unknown";
  const shopId = params.get("shop_id") ?? "unknown";

  const runtime = new PddPageRuntime({
    doc: toDomDocument(window.document),
    sessionId,
    shopId,
    transport: {
      send: (event: PddPageEvent) => {
        ipcRenderer.send("pdd-page-event", event);
      },
      onCommand: (handler) => {
        const listener = (_event: unknown, command: PddPageCommand): void => {
          const result = handler(command);
          if (result instanceof Promise) {
            void result.then((r) => ipcRenderer.send("pdd-page-command-result", r));
          } else {
            ipcRenderer.send("pdd-page-command-result", result);
          }
        };
        ipcRenderer.on("pdd-page-command", listener as never);
        return () => {
          ipcRenderer.removeListener("pdd-page-command", listener as never);
        };
      },
    },
  });
  runtime.start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
