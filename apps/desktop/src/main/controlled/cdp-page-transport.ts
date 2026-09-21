// SHEEP-301 controlled REAL page transport (version-managed, READ-SIDE ONLY).
//
// Purpose: give the controlled decoded-event adapter a page evaluator (and a real document identity)
// for the authorized REAL PDD page, without taking over the page.
//
// Boundaries (same discipline as the accepted observation transport):
// - Read side only: it can send explicit CDP domain commands (enable/evaluate/frame-tree) and read
//   CDP events. It never sends Page.reload, never enables request interception, never blocks or
//   rewrites a request, never replays anything and never calls a platform interface itself.
// - Every command is bounded by a timeout: a CDP command that never answers rejects with an explicit
//   reason instead of stalling the observation loop.
// - The main-frame document identity is the REAL document loaderId reported by the browser
//   (Page.frameNavigated / Page.getFrameTree) - never a script-side counter.

export interface ControlledPageDocument {
  readonly loaderId: string;
  readonly url: string;
}

export interface ControlledPageTransportCounters {
  readonly commandsSent: Readonly<Record<string, number>>;
  readonly eventsReceived: number;
  readonly requestPaths: Readonly<Record<string, number>>;
  readonly commandErrors: number;
}

export interface ControlledPageTransport {
  readonly targetId: string;
  readonly url: string;
  evaluate(expression: string, timeoutMs?: number): Promise<unknown>;
  currentMainFrameDocument(): Promise<ControlledPageDocument | null>;
  /** Issue the controlled navigation (only meaningful with `deferNavigation`). */
  navigate(): Promise<void>;
  counters(): ControlledPageTransportCounters;
  /** Number of page-issued `mark_read` requests observed (read-only counting, never intercepted). */
  markReadRequests(): number;
  closed(): boolean;
  close(): void;
}

const DEFAULT_TIMEOUT_MS = 15000;

function pathOf(rawUrl: string | undefined): string {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return "<none>";
  try {
    const parsed = new URL(rawUrl);
    return parsed.pathname;
  } catch {
    return "<unparsable>";
  }
}

async function listTargets(cdpBaseUrl: string): Promise<Array<{ id: string; type: string; url: string; webSocketDebuggerUrl?: string }>> {
  const response = await fetch(cdpBaseUrl + "/json/list");
  if (!response.ok) throw new Error("CDP_LIST_FAILED_" + String(response.status));
  return (await response.json()) as Array<{ id: string; type: string; url: string; webSocketDebuggerUrl?: string }>;
}

export async function openControlledPage(options: {
  readonly cdpBaseUrl: string;
  readonly url: string;
  /**
   * REBINDING AN EXISTING TARGET IS NOT SUPPORTED. The runner only ever creates its own fresh target:
   * the approved termination constraint is written against the WebContents lifecycle, and no accepted
   * design covers re-binding a terminated observation to the same external CDP target from a new
   * process. Passing a target id is a refusal at the transport boundary, not a silent reuse.
   */
  readonly reuseTargetId?: never;
  /** Attach and enable first, and let the caller decide WHEN to navigate (splits attach from load). */
  readonly deferNavigation?: boolean;
  readonly observeNetwork?: boolean;
  readonly onMainFrameDocument?: (document: ControlledPageDocument) => void;
  readonly log?: (line: string) => void;
}): Promise<ControlledPageTransport> {
  const log = options.log ?? (() => undefined);
  if (typeof (options as { reuseTargetId?: unknown }).reuseTargetId === "string") {
    throw new Error("CDP_TARGET_REBIND_NOT_SUPPORTED");
  }
  const versionResponse = await fetch(options.cdpBaseUrl + "/json/version");
  if (!versionResponse.ok) throw new Error("CDP_VERSION_FAILED_" + String(versionResponse.status));
  const version = (await versionResponse.json()) as { webSocketDebuggerUrl?: string };
  if (typeof version.webSocketDebuggerUrl !== "string") throw new Error("CDP_BROWSER_ENDPOINT_MISSING");

  const counters = { commandsSent: {} as Record<string, number>, eventsReceived: 0, requestPaths: {} as Record<string, number>, commandErrors: 0, markRead: 0 };
  let pendingId = 1;

  async function connect(endpoint: string): Promise<{
    socket: WebSocket;
    sendCommand(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
    onEvent(handler: (method: string, params: Record<string, unknown>) => void): void;
  }> {
    const socket = new WebSocket(endpoint);
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; }>();
    const handlers: Array<(method: string, params: Record<string, unknown>) => void> = [];
    socket.addEventListener("message", (event) => {
      let payload: { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message?: string } };
      try { payload = JSON.parse(String((event as MessageEvent).data)); } catch { counters.commandErrors += 1; return; }
      if (typeof payload.id === "number") {
        const entry = pending.get(payload.id);
        if (!entry) return;
        pending.delete(payload.id);
        clearTimeout(entry.timer);
        if (payload.error) entry.reject(new Error("CDP_ERROR:" + String(payload.error.message ?? "unknown")));
        else entry.resolve(payload.result);
        return;
      }
      if (typeof payload.method === "string") {
        counters.eventsReceived += 1;
        for (const handler of handlers) {
          try { handler(payload.method, payload.params ?? {}); } catch { counters.commandErrors += 1; }
        }
      }
    });
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve());
      socket.addEventListener("error", () => reject(new Error("CDP_SOCKET_ERROR")));
      socket.addEventListener("close", () => reject(new Error("CDP_SOCKET_CLOSED_DURING_OPEN")));
    });
    return {
      socket,
      onEvent(handler) { handlers.push(handler); },
      sendCommand(method, params, timeoutMs = DEFAULT_TIMEOUT_MS) {
        counters.commandsSent[method] = (counters.commandsSent[method] ?? 0) + 1;
        const id = pendingId++;
        return new Promise<unknown>((resolve, reject) => {
          const timer = setTimeout(() => {
            if (pending.has(id)) { pending.delete(id); counters.commandErrors += 1; reject(new Error("CDP_TIMEOUT:" + method)); }
          }, timeoutMs);
          pending.set(id, { resolve, reject, timer });
          try { socket.send(JSON.stringify({ id, method, params: params ?? {} })); }
          catch (error) { pending.delete(id); clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); }
        });
      },
    };
  }

  let targetId: string;
  let pageEndpoint: string | undefined;
  {
    const browser = await connect(version.webSocketDebuggerUrl);
    const created = (await browser.sendCommand("Target.createTarget", { url: "about:blank" })) as { targetId?: string };
    targetId = String(created.targetId ?? "");
    if (targetId.length === 0) throw new Error("CDP_TARGET_CREATE_FAILED");
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline && pageEndpoint === undefined) {
      const targets = await listTargets(options.cdpBaseUrl);
      const target = targets.find((entry) => entry.id === targetId && entry.type === "page");
      if (target && typeof target.webSocketDebuggerUrl === "string") pageEndpoint = target.webSocketDebuggerUrl;
      else await new Promise((done) => setTimeout(done, 200));
    }
    browser.socket.close();
    if (pageEndpoint === undefined) throw new Error("CDP_TARGET_ENDPOINT_UNAVAILABLE");
  }

  const page = await connect(pageEndpoint);
  let closed = false;

  page.onEvent((method, params) => {
    if (method === "Page.frameNavigated") {
      const frame = params.frame as { parentId?: string; loaderId?: string; url?: string } | undefined;
      if (!frame || frame.parentId !== undefined) return;
      if (typeof frame.loaderId !== "string") return;
      options.onMainFrameDocument?.({ loaderId: frame.loaderId, url: typeof frame.url === "string" ? frame.url : "" });
    }
    if (method === "Network.requestWillBeSent" && options.observeNetwork === true) {
      const request = params.request as { url?: string } | undefined;
      const path = pathOf(request?.url);
      counters.requestPaths[path] = (counters.requestPaths[path] ?? 0) + 1;
      if (path.indexOf("mark_read") >= 0) counters.markRead += 1;
    }
  });

  await page.sendCommand("Page.enable");
  if (options.observeNetwork === true) await page.sendCommand("Network.enable").catch(() => undefined);
  // The startup contract is reused: the listener/enable step finishes first, the navigation is issued
  // WITHOUT blocking on anything, and the document identity comes from the REAL navigation event.
  const navigate = async (): Promise<void> => {
    await page.sendCommand("Page.navigate", { url: options.url }).catch((error: unknown) => {
      log("page navigate error: " + String((error as { message?: unknown })?.message ?? error));
    });
  };
  if (options.deferNavigation !== true) await navigate();

  const transport: ControlledPageTransport = {
    targetId,
    url: options.url,
    async evaluate(expression: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
      const result = (await page.sendCommand("Runtime.evaluate", {
        expression, returnByValue: true, awaitPromise: true, userGesture: false,
      }, timeoutMs)) as { result?: { value?: unknown }; exceptionDetails?: { text?: string } };
      if (result && result.exceptionDetails) {
        throw new Error("PAGE_SCRIPT_THREW:" + String(result.exceptionDetails.text ?? "unknown"));
      }
      return result && result.result ? result.result.value : null;
    },
    navigate,
    async currentMainFrameDocument() {
      const frameTree = (await page.sendCommand("Page.getFrameTree")) as {
        frameTree?: { frame?: { loaderId?: string; url?: string; parentId?: string } };
      };
      const frame = frameTree.frameTree?.frame;
      if (!frame || typeof frame.loaderId !== "string" || frame.loaderId.length === 0) return null;
      if (frame.parentId !== undefined) return null;
      return { loaderId: frame.loaderId, url: typeof frame.url === "string" ? frame.url : "" };
    },
    counters() {
      return {
        commandsSent: { ...counters.commandsSent },
        eventsReceived: counters.eventsReceived,
        requestPaths: { ...counters.requestPaths },
        commandErrors: counters.commandErrors,
      };
    },
    markReadRequests: () => counters.markRead,
    closed: () => closed,
    close() {
      closed = true;
      try { page.socket.close(); } catch { /* already closed */ }
    },
  };
  return transport;
}
