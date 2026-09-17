let observerSequence = 0;

export class BoundaryObserver {
  constructor({ webContents, shopId, allowedUrl, getService, onResult, allowedCdpSessionIds = [""] }) {
    this.webContents = webContents;
    this.webContentsId = Number.isInteger(webContents?.id) ? webContents.id : -1;
    this.shopId = shopId;
    this.allowedUrl = allowedUrl;
    this.getService = getService;
    this.onResult = onResult;
    this.allowedCdpSessionIds = new Set(allowedCdpSessionIds);
    this.debugger = webContents.debugger;
    this.observerId = `observer-${++observerSequence}`;
    this.attached = false;
    this.attachScheduled = false;
    this.navigationListenerRegistered = false;
    this.enabled = false;
    this.terminal = false;
    this.lifecycle = 0;
    this.callbackGeneration = 0;
    this.activeToken = null;
    this.messageHandler = null;
    this.bindings = new Map();
    this.capturedFrames = [];
    this.events = [];
    this.results = [];
    this.ignored = [];
    this.readyResolve = null;
    this.readyReject = null;
    this.ready = new Promise((resolve, reject) => { this.readyResolve = resolve; this.readyReject = reject; });
    this.navigationHandler = () => this.invalidateLifecycle("main-navigation");
    this.detachHandler = (_event, reason) => {
      this.terminal = true;
      this.attached = false;
      this.enabled = false;
      this.activeToken = null;
      this.bindings.clear();
      this.removeListeners();
      this.events.push({ type: "debugger-detached", reason, lifecycle: this.lifecycle });
    };
  }

  start({ waitForLoad = true } = {}) {
    if (this.attached || this.attachScheduled) return;
    this.terminal = false;
    this.attachScheduled = true;
    if (waitForLoad) this.webContents.once("did-finish-load", () => { void this.attachDebugger(); });
    else setTimeout(() => { void this.attachDebugger(); }, 0);
  }

  async attachDebugger() {
    if (this.terminal || this.attached) return;
    try {
      this.debugger.attach("1.3");
      this.attached = true;
      this.attachScheduled = false;
      this.activateCallback();
      this.debugger.on("detach", this.detachHandler);
      this.webContents.on("did-start-navigation", this.navigationHandler);
      this.navigationListenerRegistered = true;
      await this.enableNetwork();
    } catch (error) {
      this.attachScheduled = false;
      this.readyReject(error);
    }
  }

  activateCallback() {
    if (this.messageHandler) this.debugger.removeListener("message", this.messageHandler);
    this.callbackGeneration += 1;
    const token = this.callbackGeneration;
    this.activeToken = token;
    this.messageHandler = (_event, method, params, sessionId) => this.handleDebuggerMessage(method, params, sessionId, token);
    this.debugger.on("message", this.messageHandler);
  }

  invalidateLifecycle(reason) {
    this.lifecycle += 1;
    this.bindings.clear();
    this.activateCallback();
    this.events.push({ type: reason, lifecycle: this.lifecycle, callbackGeneration: this.callbackGeneration });
  }

  removeListeners() {
    if (this.messageHandler) this.debugger.removeListener("message", this.messageHandler);
    this.debugger.removeListener("detach", this.detachHandler);
    if (this.navigationListenerRegistered) this.webContents.removeListener("did-start-navigation", this.navigationHandler);
    this.navigationListenerRegistered = false;
  }

  async enableNetwork() {
    if (!this.attached || this.enabled || this.terminal) return;
    try {
      await this.debugger.sendCommand("Network.enable");
      this.enabled = true;
      this.readyResolve({ lifecycle: this.lifecycle, callbackGeneration: this.callbackGeneration, shopId: this.shopId });
    } catch (error) {
      this.readyReject(error);
    }
  }

  isAllowedCdpSession(sessionId) {
    return typeof sessionId === "string" && this.allowedCdpSessionIds.has(sessionId);
  }

  bindingKey(requestId, cdpSessionId) {
    return [this.observerId, this.webContentsId, cdpSessionId, requestId].join("|");
  }

  handleDebuggerMessage(method, params, cdpSessionId, callbackToken = this.activeToken) {
    if (this.terminal) {
      this.recordResult({ status: "STOPPED", reason: "OBSERVER_TERMINAL", shopId: this.shopId, method });
      return;
    }
    if (callbackToken !== this.activeToken) {
      this.recordResult({ status: "REJECTED", reason: "STALE_CALLBACK_GENERATION", shopId: this.shopId, method, callbackToken, activeToken: this.activeToken });
      return;
    }
    if (!this.enabled) return;
    if (!this.isAllowedCdpSession(cdpSessionId)) {
      this.recordResult({ status: "REJECTED", reason: "UNAUTHORIZED_CDP_SESSION", shopId: this.shopId, method, cdpSessionId });
      return;
    }
    if (method === "Network.webSocketCreated") {
      if (!this.allowedUrl(params?.url)) {
        this.ignored.push({ method, reason: "URL_NOT_ALLOWED", params });
        return;
      }
      const context = this.getService()?.createInboundIngressContext(this.webContents) ?? null;
      if (!context) {
        this.ignored.push({ method, reason: "NO_TRUSTED_CONTEXT", params });
        return;
      }
      const key = this.bindingKey(params.requestId, cdpSessionId);
      const binding = {
        requestId: params.requestId,
        url: params.url,
        context,
        cdpSessionId,
        webContentsId: this.webContentsId,
        observerId: this.observerId,
        lifecycle: this.lifecycle,
        callbackToken,
      };
      this.bindings.set(key, binding);
      this.events.push({ type: "connection-bound", binding: this.safeBinding(binding) });
      return;
    }
    if (method === "Network.webSocketFrameReceived") this.handleFrame(params, cdpSessionId, callbackToken);
  }

  handleFrame(params, cdpSessionId, callbackToken = this.activeToken) {
    const frame = {
      requestId: params?.requestId,
      cdpSessionId,
      callbackToken,
      timestamp: params?.timestamp,
      response: params?.response,
    };
    this.capturedFrames.push(frame);
    if (this.terminal) {
      this.recordResult({ status: "STOPPED", reason: "OBSERVER_TERMINAL", shopId: this.shopId, frame: { requestId: frame.requestId, cdpSessionId } });
      return;
    }
    if (callbackToken !== this.activeToken) {
      this.recordResult({ status: "REJECTED", reason: "STALE_CALLBACK_GENERATION", shopId: this.shopId, frame: { requestId: frame.requestId, cdpSessionId } });
      return;
    }
    if (!this.isAllowedCdpSession(cdpSessionId)) {
      this.recordResult({ status: "REJECTED", reason: "UNAUTHORIZED_CDP_SESSION", shopId: this.shopId, frame: { requestId: frame.requestId, cdpSessionId } });
      return;
    }
    const key = this.bindingKey(params?.requestId, cdpSessionId);
    const binding = this.bindings.get(key);
    if (!binding || binding.callbackToken !== callbackToken || binding.lifecycle !== this.lifecycle) {
      this.recordResult({ status: "REJECTED", reason: "UNBOUND_OR_STALE_SOURCE", shopId: this.shopId, frame: { requestId: frame.requestId, cdpSessionId } });
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
    let result;
    try {
      result = this.getService().handleTrustedInboundIngress(this.webContents, binding.context, {
        payload: envelope.payload,
        sourceOccurredAt: envelope.sourceOccurredAt,
      });
    } catch (error) {
      result = { status: "FAILED", reason: "OBSERVER_HANDOFF_THREW", error: String(error) };
    }
    this.recordResult({ shopId: this.shopId, binding: this.safeBinding(binding), frame: { requestId: frame.requestId, cdpSessionId }, result });
  }

  safeBinding(binding) {
    return { requestId: binding.requestId, url: binding.url, cdpSessionId: binding.cdpSessionId, webContentsId: binding.webContentsId, observerId: binding.observerId, lifecycle: binding.lifecycle, callbackToken: binding.callbackToken };
  }

  recordResult(value) {
    this.results.push(value);
    if (this.onResult) this.onResult(value);
  }

  replayCapturedFrame(index = this.capturedFrames.length - 1, overrides = {}) {
    const frame = this.capturedFrames[index];
    if (!frame) return { status: "FAILED", reason: "NO_CAPTURED_FRAME" };
    const params = {
      requestId: overrides.requestId === undefined ? frame.requestId : overrides.requestId,
      timestamp: frame.timestamp,
      response: overrides.response ?? frame.response,
    };
    const before = this.results.length;
    this.handleFrame(params, overrides.cdpSessionId ?? frame.cdpSessionId, overrides.callbackToken ?? frame.callbackToken);
    return this.results[this.results.length - 1] ?? { status: "FAILED", reason: "NO_REPLAY_RESULT" };
  }

  replayCapturedConnectionCreated(binding) {
    const before = this.results.length;
    this.handleDebuggerMessage(
      "Network.webSocketCreated",
      { requestId: binding.requestId, url: binding.url },
      binding.cdpSessionId,
      binding.callbackToken,
    );
    return this.results[this.results.length - 1] ?? { status: "REJECTED", reason: "STALE_CALLBACK_GENERATION" };
  }

  injectFrameWithSession(params, cdpSessionId, callbackToken = this.activeToken) {
    const before = this.results.length;
    this.handleFrame(params, cdpSessionId, callbackToken);
    return this.results[this.results.length - 1] ?? { status: "FAILED", reason: "NO_INJECTION_RESULT" };
  }

  async requestExternalDetach() {
    this.debugger.detach();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async reattach() {
    this.detach();
    this.lifecycle += 1;
    this.bindings.clear();
    this.capturedFrames = [];
    this.terminal = false;
    this.attached = false;
    this.activeToken = null;
    this.start({ waitForLoad: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    return this.enableNetwork();
  }

  detach() {
    if (!this.attached) return;
    this.terminal = true;
    this.enabled = false;
    this.activeToken = null;
    this.bindings.clear();
    this.removeListeners();
    try { this.debugger.detach(); } catch {}
    this.attached = false;
    this.events.push({ type: "observer-detached", lifecycle: this.lifecycle });
  }

  snapshot() {
    return {
      observerId: this.observerId,
      webContentsId: this.webContentsId,
      shopId: this.shopId,
      lifecycle: this.lifecycle,
      callbackGeneration: this.callbackGeneration,
      attached: this.attached,
      terminal: this.terminal,
      enabled: this.enabled,
      messageListenerCount: typeof this.debugger.listenerCount === "function" ? this.debugger.listenerCount("message") : null,
      navigationListenerCount: typeof this.webContents.listenerCount === "function" ? this.webContents.listenerCount("did-start-navigation") : null,
      navigationListenerRegistered: this.navigationListenerRegistered,
      bindings: [...this.bindings.values()].map((b) => this.safeBinding(b)),
      events: this.events,
      results: this.results,
      ignored: this.ignored,
    };
  }
}
