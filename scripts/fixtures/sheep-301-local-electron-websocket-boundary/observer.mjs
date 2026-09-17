let observerSequence = 0;
const terminatedWebContents = new WeakSet();
const terminalReasonByWebContents = new WeakMap();

export class BoundaryObserver {
  constructor({ webContents, shopId, allowedUrl, getService, onResult, allowedCdpSessionIds = [""], networkEnableCommand }) {
    this.webContents = webContents;
    this.webContentsId = Number.isInteger(webContents?.id) ? webContents.id : -1;
    this.shopId = shopId;
    this.allowedUrl = allowedUrl;
    this.getService = getService;
    this.onResult = onResult;
    this.allowedCdpSessionIds = new Set(allowedCdpSessionIds);
    this.networkEnableCommand = networkEnableCommand ?? (() => this.debugger.sendCommand("Network.enable"));
    this.debugger = webContents.debugger;
    this.observerId = `observer-${++observerSequence}`;
    this.attached = false;
    this.attachScheduled = false;
    this.attachTimer = null;
    this.scheduledLoadHandler = null;
    this.navigationListenerRegistered = false;
    this.enabled = false;
    this.terminal = false;
    this.lifecycle = 0;
    this.lifecycleId = 0;
    this.callbackGeneration = 0;
    this.activeToken = null;
    this.messageHandler = null;
    this.bindings = new Map();
    this.capturedFrames = [];
    this.events = [];
    this.results = [];
    this.ignored = [];
    this.contextResolutionCalls = 0;
    this.ready = null;
    this.readyStatus = "IDLE";
    this.readyResolve = null;
    this.navigationHandler = null;
    this.detachHandler = null;
    const existingTerminalReason = terminalReasonByWebContents.get(webContents) ?? null;
    this.terminal = existingTerminalReason !== null;
    this.terminalReason = existingTerminalReason;
    this.sameWebContentsRecoverySupported = existingTerminalReason === null;
    if (this.terminal) {
      this.readyStatus = "STOPPED";
      this.ready = Promise.resolve({ status: "STOPPED", reason: "SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED" });
    }
  }

  start({ waitForLoad = true } = {}) {
    if (this.isTerminal()) return this.stopActivation("SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED");
    if (this.attached || this.attachScheduled) return this.ready;
    this.lifecycleId += 1;
    this.terminal = false;
    this.enabled = false;
    this.attachScheduled = true;
    this.readyStatus = "PENDING";
    this.ready = new Promise((resolve) => { this.readyResolve = resolve; });
    const lifecycleId = this.lifecycleId;
    if (waitForLoad) {
      this.scheduledLoadHandler = () => { void this.attachDebugger(lifecycleId); };
      this.webContents.once("did-finish-load", this.scheduledLoadHandler);
    } else {
      this.attachTimer = setTimeout(() => { void this.attachDebugger(lifecycleId); }, 0);
    }
    return this.ready;
  }

  cancelScheduledAttach() {
    if (this.scheduledLoadHandler) {
      this.webContents.removeListener("did-finish-load", this.scheduledLoadHandler);
      this.scheduledLoadHandler = null;
    }
    if (this.attachTimer !== null) {
      clearTimeout(this.attachTimer);
      this.attachTimer = null;
    }
    this.attachScheduled = false;
  }

  isTerminal() {
    return this.terminal || terminatedWebContents.has(this.webContents);
  }

  markTerminated(reason) {
    terminatedWebContents.add(this.webContents);
    terminalReasonByWebContents.set(this.webContents, reason);
    this.terminal = true;
    this.terminalReason = reason;
    this.sameWebContentsRecoverySupported = false;
  }

  stopActivation(reason = "SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED") {
    this.markTerminated(this.terminalReason ?? reason);
    this.enabled = false;
    this.attachScheduled = false;
    this.activeToken = null;
    this.bindings.clear();
    this.cancelScheduledAttach();
    this.removeListeners();
    try { if (this.debugger.isAttached()) this.debugger.detach(); } catch {}
    this.attached = false;
    this.readyStatus = "STOPPED";
    this.readyResolve = null;
    this.ready = Promise.resolve({ status: "STOPPED", reason: "SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED" });
    return this.ready;
  }

  resolveReady(value) {
    if (this.readyStatus === "PENDING" && this.readyResolve) {
      this.readyStatus = value.status ?? "SETTLED";
      this.readyResolve(value);
    }
    return value;
  }

  async attachDebugger(lifecycleId = this.lifecycleId) {
    if (this.isTerminal() || lifecycleId !== this.lifecycleId || this.attached) return;
    try {
      if (!this.debugger.isAttached()) this.debugger.attach("1.3");
      if (this.isTerminal() || lifecycleId !== this.lifecycleId) {
        try { this.debugger.detach(); } catch {}
        return;
      }
      this.attached = true;
      this.attachScheduled = false;
      this.activateCallback();
      this.detachHandler = (_event, reason) => {
        this.stopLifecycle("EXTERNAL_DEBUGGER_DETACH:" + reason, lifecycleId);
      };
      this.navigationHandler = (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame !== true || isInPlace === true) return;
        this.sameWebContentsRecoverySupported = false;
        this.stopLifecycle("MAIN_DOCUMENT_REPLACEMENT", lifecycleId);
      };
      this.debugger.on("detach", this.detachHandler);
      this.webContents.on("did-start-navigation", this.navigationHandler);
      this.navigationListenerRegistered = true;
      await this.enableNetwork(lifecycleId);
    } catch (error) {
      this.cancelScheduledAttach();
      this.resolveReady({ status: "FAILED", reason: String(error?.message ?? error) });
      this.stopLifecycle("ATTACH_FAILED", lifecycleId);
    }
  }

  activateCallback() {
    if (this.messageHandler) this.debugger.removeListener("message", this.messageHandler);
    this.callbackGeneration += 1;
    const token = this.callbackGeneration;
    this.activeToken = token;
    this.messageHandler = (_event, method, params, sessionId) => this.handleDebuggerMessage(method, params, sessionId, token, "debugger-callback");
    this.debugger.on("message", this.messageHandler);
  }

  async enableNetwork(lifecycleId = this.lifecycleId) {
    if (this.isTerminal() || !this.attached || lifecycleId !== this.lifecycleId || this.enabled) return;
    const callbackToken = this.activeToken;
    try {
      await this.networkEnableCommand();
      if (this.isTerminal() || !this.attached || lifecycleId !== this.lifecycleId || callbackToken !== this.activeToken) return;
      this.enabled = true;
      this.resolveReady({ status: "READY", lifecycle: this.lifecycle, callbackGeneration: this.callbackGeneration, shopId: this.shopId });
    } catch (error) {
      if (this.isTerminal() || lifecycleId !== this.lifecycleId) return;
      this.resolveReady({ status: "FAILED", reason: String(error?.message ?? error) });
      this.stopLifecycle("NETWORK_ENABLE_FAILED");
    }
  }

  isAllowedCdpSession(sessionId) {
    return typeof sessionId === "string" && this.allowedCdpSessionIds.has(sessionId);
  }

  bindingKey(requestId, cdpSessionId) {
    return [this.observerId, this.webContentsId, cdpSessionId, requestId].join("|");
  }

  handleDebuggerMessage(method, params, cdpSessionId, callbackToken = this.activeToken, delivery = "debugger-callback") {
    if (this.terminal) {
      this.recordResult({ status: "STOPPED", reason: "OBSERVER_TERMINAL", shopId: this.shopId, method, delivery });
      return;
    }
    if (callbackToken !== this.activeToken) {
      this.recordResult({ status: "REJECTED", reason: "STALE_CALLBACK_GENERATION", shopId: this.shopId, method, delivery, callbackToken, activeToken: this.activeToken });
      return;
    }
    if (!this.enabled) return;
    if (!this.isAllowedCdpSession(cdpSessionId)) {
      this.recordResult({ status: "REJECTED", reason: "UNAUTHORIZED_CDP_SESSION", shopId: this.shopId, method, delivery, cdpSessionId });
      return;
    }
    if (method === "Network.webSocketCreated") {
      if (!this.allowedUrl(params?.url)) {
        this.ignored.push({ method, reason: "URL_NOT_ALLOWED", params });
        return;
      }
      const context = this.resolveContextForConnection(params, cdpSessionId, callbackToken, delivery);
      if (!context) return;
      const binding = {
        requestId: params.requestId,
        url: params.url,
        context,
        cdpSessionId,
        webContentsId: this.webContentsId,
        observerId: this.observerId,
        lifecycle: this.lifecycle,
        callbackToken,
        delivery,
      };
      this.bindings.set(this.bindingKey(params.requestId, cdpSessionId), binding);
      this.events.push({ type: "connection-bound", binding: this.safeBinding(binding) });
      return;
    }
    if (method === "Network.webSocketFrameReceived") this.handleFrame(params, cdpSessionId, callbackToken);
  }

  resolveContextForConnection(params, cdpSessionId, callbackToken, delivery) {
    if (!this.terminal && callbackToken === this.activeToken && this.isAllowedCdpSession(cdpSessionId)) {
      this.contextResolutionCalls += 1;
      const context = this.getService()?.createInboundIngressContext(this.webContents) ?? null;
      if (!context) this.ignored.push({ method: "Network.webSocketCreated", reason: "NO_TRUSTED_CONTEXT", params, delivery });
      return context;
    }
    this.recordResult({ status: "STOPPED", reason: "SOURCE_CONTEXT_NOT_ACCEPTED", shopId: this.shopId, delivery, cdpSessionId });
    return null;
  }

  handleFrame(params, cdpSessionId, callbackToken = this.activeToken) {
    const frame = { requestId: params?.requestId, cdpSessionId, callbackToken, timestamp: params?.timestamp, response: params?.response };
    this.capturedFrames.push(frame);
    if (this.terminal) {
      this.recordResult({ status: "STOPPED", reason: "OBSERVER_TERMINAL", shopId: this.shopId });
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
    const binding = this.bindings.get(this.bindingKey(params?.requestId, cdpSessionId));
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

  stopLifecycle(reason, lifecycleId = this.lifecycleId) {
    if (this.isTerminal() || lifecycleId !== this.lifecycleId) return;
    this.markTerminated(reason);
    this.enabled = false;
    this.attachScheduled = false;
    this.activeToken = null;
    this.bindings.clear();
    this.cancelScheduledAttach();
    this.removeListeners();
    try { if (this.debugger.isAttached()) this.debugger.detach(); } catch {}
    this.attached = false;
    this.lifecycle += 1;
    this.resolveReady({ status: "CANCELLED", reason });
    this.events.push({ type: "lifecycle-stopped", reason, lifecycle: this.lifecycle });
  }

  removeListeners() {
    if (this.messageHandler) this.debugger.removeListener("message", this.messageHandler);
    if (this.detachHandler) this.debugger.removeListener("detach", this.detachHandler);
    if (this.navigationListenerRegistered && this.navigationHandler) this.webContents.removeListener("did-start-navigation", this.navigationHandler);
    this.navigationListenerRegistered = false;
    this.detachHandler = null;
    this.navigationHandler = null;
  }

  safeBinding(binding) {
    return { requestId: binding.requestId, url: binding.url, cdpSessionId: binding.cdpSessionId, webContentsId: binding.webContentsId, observerId: binding.observerId, lifecycle: binding.lifecycle, callbackToken: binding.callbackToken, delivery: binding.delivery };
  }

  recordResult(value) {
    this.results.push(value);
    if (this.onResult) this.onResult(value);
  }

  injectFrameWithSession(params, cdpSessionId, callbackToken = this.activeToken) {
    const before = this.results.length;
    this.handleFrame(params, cdpSessionId, callbackToken);
    return this.results[this.results.length - 1] ?? { status: "FAILED", reason: "NO_INJECTION_RESULT" };
  }

  replayCapturedFrame(index = this.capturedFrames.length - 1, overrides = {}) {
    const frame = this.capturedFrames[index];
    if (!frame) return { status: "FAILED", reason: "NO_CAPTURED_FRAME" };
    const before = this.results.length;
    this.handleFrame({ requestId: overrides.requestId ?? frame.requestId, timestamp: frame.timestamp, response: overrides.response ?? frame.response }, overrides.cdpSessionId ?? frame.cdpSessionId, overrides.callbackToken ?? frame.callbackToken);
    return this.results[this.results.length - 1] ?? { status: "FAILED", reason: "NO_REPLAY_RESULT" };
  }

  replayCapturedConnectionCreated(binding) {
    const before = this.results.length;
    this.handleDebuggerMessage("Network.webSocketCreated", { requestId: binding.requestId, url: binding.url }, binding.cdpSessionId, binding.callbackToken, "captured-old-event");
    return this.results[this.results.length - 1] ?? { status: "STOPPED", reason: "STALE_OR_CANCELLED_SOURCE" };
  }

  deliverRawConnectionCreatedThroughCurrentListener(params, cdpSessionId = "") {
    if (this.isTerminal() || !this.messageHandler) {
      const result = { status: "STOPPED", reason: "SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED", shopId: this.shopId, method: "Network.webSocketCreated", delivery: "raw-current-listener" };
      this.recordResult(result);
      return result;
    }
    const before = this.results.length;
    this.messageHandler({}, "Network.webSocketCreated", params, cdpSessionId);
    return this.results[this.results.length - 1] ?? { status: "ACCEPTED", reason: "CONNECTION_CONTEXT_RESOLVED", shopId: this.shopId };
  }

  async requestExternalDetach() {
    if (this.debugger.isAttached()) this.debugger.detach();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async detach() {
    this.stopLifecycle("OBSERVER_DETACHED");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async reattach() {
    if (this.isTerminal()) return this.stopActivation("SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED");
    await this.detach();
    return this.stopActivation("SAME_WEBCONTENTS_RECOVERY_NOT_SUPPORTED");
  }

  snapshot() {
    return {
      observerId: this.observerId,
      webContentsId: this.webContentsId,
      shopId: this.shopId,
      lifecycle: this.lifecycle,
      callbackGeneration: this.callbackGeneration,
      attached: this.attached,
      attachScheduled: this.attachScheduled,
      terminal: this.isTerminal(),
      terminalReason: this.terminalReason,
      enabled: this.enabled,
      readyStatus: this.readyStatus,
      contextResolutionCalls: this.contextResolutionCalls,
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
