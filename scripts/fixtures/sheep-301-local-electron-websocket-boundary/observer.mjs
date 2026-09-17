
export class BoundaryObserver {
  constructor({ webContents, shopId, allowedUrl, getService, onResult }) {
    this.webContents = webContents;
    this.shopId = shopId;
    this.allowedUrl = allowedUrl;
    this.getService = getService;
    this.onResult = onResult;
    this.debugger = webContents.debugger;
    this.attached = false;
    this.enabled = false;
    this.terminal = false;
    this.lifecycle = 0;
    this.bindings = new Map();
    this.capturedFrames = [];
    this.events = [];
    this.results = [];
    this.ignored = [];
    this.readyResolve = null;
    this.readyReject = null;
    this.ready = new Promise((resolve, reject) => { this.readyResolve = resolve; this.readyReject = reject; });
    this.messageHandler = (_event, method, params, sessionId) => this.handleDebuggerMessage(method, params, sessionId);
    this.navigationHandler = () => {
      this.lifecycle += 1;
      this.bindings.clear();
      this.events.push({ type: "main-navigation", lifecycle: this.lifecycle });
    };
    this.detachHandler = (_event, reason) => {
      this.terminal = true;
      this.attached = false;
      this.enabled = false;
      this.bindings.clear();
      this.events.push({ type: "debugger-detached", reason, lifecycle: this.lifecycle });
    };
  }

  start({ waitForLoad = true } = {}) {
    if (this.attached) return;
    this.terminal = false;
    this.attached = true;
    this.debugger.attach("1.3");
    this.debugger.on("message", this.messageHandler);
    this.debugger.on("detach", this.detachHandler);
    this.webContents.on("did-start-navigation", this.navigationHandler);
    // The observer is attached before the fixture load starts. Wait for the
    // first document load before enabling Network; enabling before a target is
    // ready can leave the CDP command pending.
    if (waitForLoad) this.webContents.once("did-finish-load", () => { void this.enableNetwork(); });
    else setTimeout(() => { void this.enableNetwork(); }, 0);
  }

  async enableNetwork() {
    if (!this.attached || this.enabled) return;
    try {
      await this.debugger.sendCommand("Network.enable");
      this.enabled = true;
      this.readyResolve({ lifecycle: this.lifecycle, shopId: this.shopId });
    } catch (error) {
      this.readyReject(error);
    }
  }

  handleDebuggerMessage(method, params, sessionId) {
    if (!this.enabled || this.terminal) return;
    if (method === "Network.webSocketCreated") {
      if (!this.allowedUrl(params?.url)) {
        this.ignored.push({ method, reason: "URL_NOT_ALLOWED", params });
        return;
      }
      const service = this.getService();
      const context = service ? service.createInboundIngressContext(this.webContents) : null;
      if (!context) {
        this.ignored.push({ method, reason: "NO_TRUSTED_CONTEXT", params });
        return;
      }
      const binding = {
        requestId: params.requestId,
        url: params.url,
        context,
        lifecycle: this.lifecycle,
        sessionId,
      };
      this.bindings.set(params.requestId, binding);
      this.events.push({ type: "connection-bound", binding, lifecycle: this.lifecycle });
      return;
    }
    if (method === "Network.webSocketFrameReceived") {
      this.handleFrame(params, sessionId);
    }
  }

  handleFrame(params, sessionId) {
    const frame = { requestId: params?.requestId, sessionId, timestamp: params?.timestamp, response: params?.response };
    this.capturedFrames.push(frame);
    if (this.terminal) {
      this.recordResult({ status: "STOPPED", reason: "OBSERVER_TERMINAL", shopId: this.shopId });
      return;
    }
    const binding = this.bindings.get(params?.requestId);
    if (!binding || binding.lifecycle !== this.lifecycle) {
      this.recordResult({ status: "REJECTED", reason: "UNBOUND_OR_STALE_REQUEST_ID", shopId: this.shopId });
      return;
    }
    const response = params?.response;
    if (!response || response.opcode !== 1 || typeof response.payloadData !== "string") {
      this.recordResult({ status: "REJECTED", reason: "UNSUPPORTED_NON_TEXT_FRAME", shopId: this.shopId });
      return;
    }
    let envelope;
    try { envelope = JSON.parse(response.payloadData); } catch {
      this.recordResult({ status: "REJECTED", reason: "INVALID_JSON_FRAME", shopId: this.shopId });
      return;
    }
    if (!envelope || envelope.kind !== "proof-frame" || typeof envelope.payload !== "object" || envelope.payload === null) {
      this.recordResult({ status: "REJECTED", reason: "INVALID_FIXTURE_FRAME", shopId: this.shopId });
      return;
    }
    const service = this.getService();
    let result;
    try {
      result = service.handleTrustedInboundIngress(this.webContents, binding.context, {
        payload: envelope.payload,
        sourceOccurredAt: envelope.sourceOccurredAt,
      });
    } catch (error) {
      result = { status: "FAILED", reason: "OBSERVER_HANDOFF_THREW", error: String(error) };
    }
    this.recordResult({ shopId: this.shopId, binding, result });
  }

  recordResult(value) {
    this.results.push(value);
    if (this.onResult) this.onResult(value);
  }

  replayFrame({ requestId, response, sessionId = "" }) {
    const before = this.results.length;
    this.handleFrame({ requestId, response, timestamp: 0 }, sessionId);
    return this.results[this.results.length - 1] ?? { status: "FAILED", reason: "NO_REPLAY_RESULT" };
  }

  replayCapturedFrame(index = this.capturedFrames.length - 1, overrides = {}) {
    const frame = this.capturedFrames[index];
    if (!frame) return { status: "FAILED", reason: "NO_CAPTURED_FRAME" };
    const params = {
      requestId: overrides.requestId === undefined ? frame.requestId : overrides.requestId,
      timestamp: frame.timestamp,
      response: frame.response,
    };
    const before = this.results.length;
    this.handleFrame(params, frame.sessionId);
    return this.results[this.results.length - 1] ?? { status: "FAILED", reason: "NO_REPLAY_RESULT" };
  }

  async reattach() {
    this.detach();
    this.lifecycle += 1;
    this.bindings.clear();
    this.capturedFrames = [];
    this.terminal = false;
    this.attached = false;
    this.start({ waitForLoad: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    return this.enableNetwork();
  }

  replayConnectionCreated(binding, lifecycle = binding.lifecycle) {
    if (this.terminal || lifecycle !== this.lifecycle) {
      const result = { status: "REJECTED", reason: "STALE_CONNECTION_CREATED", shopId: this.shopId };
      this.recordResult(result);
      return result;
    }
    this.bindings.set(binding.requestId, binding);
    this.events.push({ type: "connection-replayed", binding, lifecycle: this.lifecycle });
    return { status: "BOUND", requestId: binding.requestId, lifecycle: this.lifecycle };
  }

  detach() {
    if (!this.attached) return;
    this.terminal = true;
    this.enabled = false;
    this.bindings.clear();
    this.debugger.removeListener("message", this.messageHandler);
    this.debugger.removeListener("detach", this.detachHandler);
    this.webContents.removeListener("did-start-navigation", this.navigationHandler);
    try { this.debugger.detach(); } catch {}
    this.attached = false;
    this.events.push({ type: "observer-detached", lifecycle: this.lifecycle });
  }

  snapshot() {
    return {
      shopId: this.shopId,
      lifecycle: this.lifecycle,
      attached: this.attached,
      terminal: this.terminal,
      enabled: this.enabled,
      bindings: [...this.bindings.values()].map((b) => ({ requestId: b.requestId, url: b.url, lifecycle: b.lifecycle, sessionId: b.sessionId })),
      events: this.events,
      results: this.results,
      ignored: this.ignored,
    };
  }
}
