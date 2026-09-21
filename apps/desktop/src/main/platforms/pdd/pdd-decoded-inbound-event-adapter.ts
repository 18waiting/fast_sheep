// SHEEP-301 PDD_DECODED_INBOUND_EVENT_ADAPTER_STABILIZATION
//
// Turns the proven page-event entry into a version-controlled, DEFAULT-OFF controlled adapter:
//   - install/uninstall a single-purpose page observer (embedded source, no external asset step);
//   - drain bounded, structured per-message events;
//   - cross-check the page-reported document generation against the Main-held binding (cross-check
//     only: the page never becomes an identity source);
//   - isolate every failure and report it explicitly, never falling back to nickname matching, DOM
//     text guessing or any legacy path.
//
// The canonical contract is untouched: message identity keeps the existing
// `AUTHORITATIVE_PLATFORM_ID` meaning (the value came from the platform payload field), while this
// adapter additionally records that the PAGE-DECODED event path itself is unverified
// (`PAYLOAD_SUPPLIED_UNVERIFIED`) - two different dimensions, never silently upgraded.

/** Version-controlled page-side observer source (single purpose, observation only). */
export const PDD_DECODED_EVENT_OBSERVER_SOURCE = [
  "(function () {",
  "  if (window.__sheep301Adapter && window.__sheep301Adapter.installed) return { ok: true, alreadyInstalled: true, storeReachableVia: window.__sheep301Adapter.storeReachableVia };",
  "  var state = { installed: false, subscribed: false, reason: null, storeReachableVia: null, sdkHookProbe: null, mutationCounts: {}, events: [], dropped: 0, truncated: 0, maxEvents: 400, installedAt: new Date().toISOString(), generation: null, unsubscribe: null };",
  "  window.__sheep301Adapter = state;",
  "  var roots = [document.querySelector('#app'), document.querySelector('.merchantApp'), document.body];",
  "  var store = null;",
  "  for (var i = 0; i < roots.length; i += 1) {",
  "    var root = roots[i];",
  "    if (!root) continue;",
  "    if (root.__vue__ && root.__vue__.$store) { store = root.__vue__.$store; state.storeReachableVia = 'root.__vue__.$store'; break; }",
  "    if (root.__vue_app__ && root.__vue_app__.config && root.__vue_app__.config.globalProperties && root.__vue_app__.config.globalProperties.$store) { store = root.__vue_app__.config.globalProperties.$store; state.storeReachableVia = 'root.__vue_app__.config.globalProperties.$store'; break; }",
  "  }",
  "  if (!store) { state.reason = 'STORE_UNREACHABLE'; return { ok: false, reason: state.reason }; }",
  "  try {",
  "    var probeKeys = [];",
  "    for (var key in window) {",
  "      try { var value = window[key]; if (value && typeof value === 'object' && value.constructor && value.constructor.hooks && Array.isArray(value.constructor.hooks.onMessage)) probeKeys.push(key); } catch (inner) { /* ignore */ }",
  "    }",
  "    state.sdkHookProbe = { reachable: probeKeys.length > 0, globalKeysWithHooks: probeKeys.slice(0, 5) };",
  "  } catch (error) { state.sdkHookProbe = { reachable: false, error: String(error && error.name ? error.name : error) }; }",
  "  var MESSAGE_MUTATIONS = ['UPDATE_CHAT_LIST_ONE', 'CHANGE_MESSAGE', 'UPDATE_CHAT_LIST_ALL'];",
  "  var toMessages = function (payload) {",
  "    var out = [];",
  "    if (!payload || typeof payload !== 'object') return out;",
  "    if (payload.lastMessage && typeof payload.lastMessage === 'object' && typeof payload.lastMessage.msg_id === 'string') out.push(payload.lastMessage);",
  "    if (Array.isArray(payload.messageList)) { for (var i = 0; i < payload.messageList.length; i += 1) { var item = payload.messageList[i]; if (item && typeof item === 'object' && typeof item.msg_id === 'string') out.push(item); } }",
  "    return out;",
  "  };",
  "  var record = function (mutation, mutationPayload) {",
  "    try {",
  "      var name = mutation && typeof mutation.type === 'string' ? mutation.type : '<unknown>';",
  "      state.mutationCounts[name] = (state.mutationCounts[name] || 0) + 1;",
  "      if (MESSAGE_MUTATIONS.indexOf(name) === -1) return;",
  "      var messages = toMessages(mutationPayload);",
  "      for (var i = 0; i < messages.length; i += 1) {",
  "        var message = messages[i];",
  "        var entry = {",
  "          observedAt: new Date().toISOString(),",
  "          mutation: name,",
  "          pageDocumentGeneration: state.generation,",
  "          message: {",
  "            msg_id: typeof message.msg_id === 'string' ? message.msg_id : null,",
  "            client_msg_id: typeof message.client_msg_id === 'string' ? message.client_msg_id : null,",
  "            type: typeof message.type === 'number' ? message.type : null,",
  "            content: typeof message.content === 'string' ? message.content : null,",
  "            ts: message.ts === undefined ? null : message.ts,",
  "            is_history: message.is_history === true,",
  "            from: message.from && typeof message.from === 'object' ? { role: message.from.role === undefined ? null : message.from.role, uid: message.from.uid === undefined ? null : message.from.uid } : null,",
  "            to: message.to && typeof message.to === 'object' ? { role: message.to.role === undefined ? null : message.to.role, uid: message.to.uid === undefined ? null : message.to.uid } : null",
  "          }",
  "        };",
  "        if (state.events.length >= state.maxEvents) { state.dropped += 1; continue; }",
  "        state.events.push(entry);",
  "      }",
  "    } catch (error) { state.dropped += 1; }",
  "  };",
  "  try {",
  "    state.unsubscribe = store.subscribe(function (mutation, storeState) {",
  "      try { record(mutation, mutation.payload); } catch (error) { state.dropped += 1; }",
  "    });",
  "    state.subscribed = true;",
  "  } catch (error) { state.reason = 'SUBSCRIBE_FAILED:' + String(error && error.name ? error.name : error); return { ok: false, reason: state.reason }; }",
  "  state.installed = true;",
  "  state.setGeneration = function (value) { state.generation = typeof value === 'number' ? value : null; return state.generation; };",
  "  state.drain = function (max) {",
  "    var limit = typeof max === 'number' && max > 0 ? max : state.events.length;",
  "    var drained = state.events.splice(0, limit);",
  "    return { events: drained, remaining: state.events.length, mutationCounts: state.mutationCounts, dropped: state.dropped };",
  "  };",
  "  state.snapshot = function () { return { installed: state.installed, subscribed: state.subscribed, storeReachableVia: state.storeReachableVia, sdkHookProbe: state.sdkHookProbe, pending: state.events.length, dropped: state.dropped, mutationNames: Object.keys(state.mutationCounts).length, generation: state.generation }; };",
  "  state.uninstall = function () {",
  "    try { if (typeof state.unsubscribe === 'function') state.unsubscribe(); } catch (error) { /* ignore */ }",
  "    try { delete window.__sheep301Adapter; } catch (error) { window.__sheep301Adapter = undefined; }",
  "    return { ok: true };",
  "  };",
  "  return { ok: true, installed: true, storeReachableVia: state.storeReachableVia, sdkHookProbe: state.sdkHookProbe };",
  "})()",
].join("\n");

export interface PddPageEvaluator {
  /** Runs an expression inside the controlled page (Main: webContents.executeJavaScript). */
  evaluate(expression: string): Promise<unknown>;
}

export interface PddDecodedEventDocumentBinding {
  readonly sessionId: string;
  readonly shopId: string;
  readonly documentGeneration: number;
}

export interface PddDecodedEventAdapterOptions {
  /** DEFAULT OFF: nothing touches the page unless this is explicitly true. */
  readonly enabled: boolean;
  readonly evaluate: PddPageEvaluator;
  /** Main-held document binding; the only identity source. */
  readonly document: () => PddDecodedEventDocumentBinding;
  /** Upper bound of messages returned by one drain. */
  readonly maxMessagesPerDrain?: number;
  readonly now?: () => string;
}

export type PddDecodedEventAdapterState = "DISABLED" | "INSTALLED" | "FAILED" | "UNLOADED";

export interface PddDecodedEventAdapter {
  install(): Promise<{ ok: boolean; reason?: string; storeReachableVia?: string | null }>;
  drain(): Promise<{
    ok: boolean;
    reason?: string;
    messages: readonly unknown[];
    truncated: boolean;
    dropped: number;
    duplicateNotifications: number;
    diagnostics: readonly string[];
  }>;
  unload(): Promise<{ ok: boolean; reason?: string }>;
  state(): PddDecodedEventAdapterState;
}

function sanitized(error: unknown): string {
  const name = error instanceof Error ? error.name : typeof error;
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (/timeout|timed out/i.test(text)) return "TIMEOUT";
  if (/destroyed|detached|not attached/i.test(text)) return "PAGE_UNAVAILABLE";
  return "ERROR_" + String(name).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 24);
}

export function createPddDecodedEventAdapter(options: PddDecodedEventAdapterOptions): PddDecodedEventAdapter {
  const maxMessages = options.maxMessagesPerDrain ?? 200;
  let state: PddDecodedEventAdapterState = options.enabled === true ? "FAILED" : "DISABLED";

  async function evaluate(expression: string): Promise<{ ok: boolean; value?: unknown; reason?: string }> {
    try {
      const value = await options.evaluate.evaluate(expression);
      return { ok: true, value };
    } catch (error) {
      return { ok: false, reason: sanitized(error) };
    }
  }

  return {
    async install() {
      if (options.enabled !== true) return { ok: false, reason: "ADAPTER_DISABLED" };
      const result = await evaluate(PDD_DECODED_EVENT_OBSERVER_SOURCE);
      if (!result.ok) { state = "FAILED"; return { ok: false, reason: result.reason }; }
      const value = result.value as { ok?: unknown; reason?: unknown; storeReachableVia?: unknown } | null | undefined;
      if (!value || value.ok !== true) {
        state = "FAILED";
        return { ok: false, reason: typeof value?.reason === "string" ? value.reason : "PAGE_OBSERVER_NOT_INSTALLED" };
      }
      state = "INSTALLED";
      return { ok: true, storeReachableVia: typeof value.storeReachableVia === "string" ? value.storeReachableVia : null };
    },

    async drain() {
      if (state === "DISABLED") return { ok: false, reason: "ADAPTER_DISABLED", messages: [], truncated: false, dropped: 0, duplicateNotifications: 0, diagnostics: [] };
      if (state === "UNLOADED") return { ok: false, reason: "ADAPTER_UNLOADED", messages: [], truncated: false, dropped: 0, duplicateNotifications: 0, diagnostics: [] };
      if (state !== "INSTALLED") return { ok: false, reason: "ADAPTER_NOT_INSTALLED", messages: [], truncated: false, dropped: 0, duplicateNotifications: 0, diagnostics: [] };

      const binding = options.document();
      // Tell the page observer the CURRENT Main-held generation: the page value is only ever used for
      // cross-checking, never as an identity source.
      await evaluate("(function () { if (!window.__sheep301Adapter || !window.__sheep301Adapter.setGeneration) return null; return window.__sheep301Adapter.setGeneration(" + String(binding.documentGeneration) + "); })()");
      // The BATCH LIMIT is applied on the page side, so anything above one batch stays in the page
      // buffer and is retrieved by the next drain - a batch limit must never silently discard data.
      const drained = await evaluate("(function () { if (!window.__sheep301Adapter || !window.__sheep301Adapter.drain) return null; return window.__sheep301Adapter.drain(" + String(maxMessages) + "); })()");
      if (!drained.ok) return { ok: false, reason: drained.reason, messages: [], truncated: false, dropped: 0, duplicateNotifications: 0, diagnostics: [] };
      const payload = drained.value as { events?: unknown; dropped?: unknown; remaining?: unknown } | null | undefined;
      if (!payload || !Array.isArray(payload.events)) {
        return { ok: false, reason: "DRAIN_SHAPE_INVALID", messages: [], truncated: false, dropped: 0, duplicateNotifications: 0, diagnostics: [] };
      }

      const diagnostics: string[] = [];
      const messages: unknown[] = [];
      const seen = new Set<string>();
      let duplicateNotifications = 0;
      for (const entry of payload.events) {
        const record = entry as { message?: unknown; pageDocumentGeneration?: unknown };
        const message = record && typeof record === "object" ? record.message : null;
        if (!message || typeof message !== "object") { diagnostics.push("MESSAGE_SHAPE_INVALID"); continue; }
        const identity = typeof (message as { msg_id?: unknown }).msg_id === "string" ? String((message as { msg_id?: unknown }).msg_id) : null;
        if (identity !== null) {
          if (seen.has(identity)) duplicateNotifications += 1;
          else seen.add(identity);
        }
        const pageGeneration = typeof record.pageDocumentGeneration === "number" ? record.pageDocumentGeneration : null;
        if (pageGeneration !== null && pageGeneration !== binding.documentGeneration) {
          // The page reported a different generation: identity is not admissible from this event.
          diagnostics.push("GENERATION_MISMATCH");
          continue;
        }
        const isHistory = (message as { is_history?: unknown }).is_history === true;
        if (!isHistory) {
          // A missing history marker is NOT evidence of a real-time arrival: keep the limitation.
          diagnostics.push("NEWNESS_UNVERIFIED");
        }
        messages.push({ source: "PAGE_DECODED_EVENT", identityAuthority: "PAYLOAD_SUPPLIED_UNVERIFIED", message, mutation: (entry as { mutation?: unknown }).mutation ?? null });
      }
      const remaining = Number(payload.remaining ?? 0);
      if (remaining > 0) diagnostics.push("BATCH_LIMIT_REACHED_REMAINING_" + String(remaining));
      if (payload.dropped && Number(payload.dropped) > 0) diagnostics.push("PAGE_OBSERVER_DROPPED_" + String(payload.dropped));
      return { ok: true, messages, truncated: false, dropped: Number(payload.dropped ?? 0), duplicateNotifications, diagnostics };
    },

    async unload() {
      if (state === "DISABLED") return { ok: false, reason: "ADAPTER_DISABLED" };
      const result = await evaluate("(function () { if (!window.__sheep301Adapter || !window.__sheep301Adapter.uninstall) return { ok: false, reason: 'NOT_INSTALLED' }; return window.__sheep301Adapter.uninstall(); })()");
      state = "UNLOADED";
      if (!result.ok) return { ok: false, reason: result.reason };
      const value = result.value as { ok?: unknown; reason?: unknown } | null | undefined;
      return value && value.ok === true ? { ok: true } : { ok: false, reason: typeof value?.reason === "string" ? value.reason : "UNLOAD_FAILED" };
    },

    state() { return state; },
  };
}
