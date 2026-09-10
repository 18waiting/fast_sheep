// M7 PDD page preload (clean-room). Runs inside the PDD WebContentsView.
// Security: sandbox=true, contextIsolation=true, nodeIntegration=false.
// Exposes NOTHING to the seller page (no contextBridge call). It only:
//  - observes the page DOM (synthetic contract)
//  - sends schema-validated normalized events to trusted Main
//  - executes finite-allowlist commands from trusted Main
import { ipcRenderer } from "electron";
import { PddPageRuntime, toDomDocument, type PddPageCommand, type PddPageEvent } from "@fastwork/platform-pdd";

const PDD_PAGE_LIFECYCLE_START_CHANNEL = "pdd-page-lifecycle-start";

interface DocumentObservation {
  session_id: string;
  shop_id: string;
  document_generation: number;
}

function isDocumentObservation(value: unknown): value is DocumentObservation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.session_id === "string"
    && typeof candidate.shop_id === "string"
    && Number.isInteger(candidate.document_generation)
    && (candidate.document_generation as number) > 0;
}

function boot(observation: DocumentObservation): void {
  const { session_id: sessionId, shop_id: shopId, document_generation: documentGeneration } = observation;

  const runtime = new PddPageRuntime({
    doc: toDomDocument(window.document),
    sessionId,
    shopId,
    documentGeneration,
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

let started = false;
function start(observation: DocumentObservation): void {
  if (started) return;
  started = true;
  boot(observation);
}

ipcRenderer.on(PDD_PAGE_LIFECYCLE_START_CHANNEL, (_event: unknown, observation: unknown) => {
  if (started || !isDocumentObservation(observation)) return;
  start(observation);
});

// Explicit local fixtures keep their deterministic DOMContentLoaded startup.
// Production documents never consume URL parameters and wait for Main's real
// WebContents lifecycle notification above.
if (window.location.protocol === "file:") {
  const params = new URLSearchParams(window.location.search);
  const fixtureObservation = {
    session_id: params.get("session_id") ?? "",
    shop_id: params.get("shop_id") ?? "",
    document_generation: Number(params.get("document_generation")),
  };
  if (isDocumentObservation(fixtureObservation)) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => start(fixtureObservation), { once: true });
    } else {
      start(fixtureObservation);
    }
  }
}
