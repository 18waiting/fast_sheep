// M7 renderer platform surface (clean-room).
// Reserves the visual platform region, reports local bounds via ResizeObserver,
// and shows a loading/login/unsupported status overlay. It NEVER reads PDD DOM,
// sends chat messages directly, accesses the seller page, or owns the session.
import type { UiState } from "../state/view-model.js";
import { platformIsReady } from "../state/platform-view-state.js";
import { clear, el } from "./dom.js";

export interface PlatformSurfaceActions {
  onBoundsChange(bounds: { x: number; y: number; width: number; height: number; visible: boolean }): void;
}

export const PLATFORM_CAPABILITY_QUALIFIER = "此处仅显示本地兼容能力声明，不代表平台支持、生产就绪或操作授权。";

export function capabilityPresentationLabel(_platformType: string | null, _key: string, declared: boolean): string {
  return declared ? "已声明" : "未声明";
}

export function capabilityPresentationClass(_platformType: string | null, _key: string, declared: boolean): string {
  return declared ? "cap-chip declared" : "cap-chip undeclared";
}

export function renderPlatformSurface(root: HTMLElement, state: UiState, actions: PlatformSurfaceActions): void {
  clear(root);
  const surface = el("div", "platform-surface");
  surface.setAttribute("data-platform", state.platform?.platformType ?? "none");
  surface.setAttribute("data-session-status", state.platform?.sessionStatus ?? "none");

  const status = state.platform?.sessionStatus;
  const ready = platformIsReady(state.platform ?? { activeShopId: null, platformType: null, sessionStatus: null, viewVisible: false, lastSafeError: null, capabilities: {} });
  if (!ready) {
    const overlay = el("div", "platform-overlay");
    const label =
      status === "LOGIN_REQUIRED" ? "需要登录 (手动登录)" :
      status === "LOADING" ? "加载中…" :
      status === "CREATING" ? "创建会话…" :
      status === "DOM_UNSUPPORTED" ? "页面结构不支持 (已安全停用)" :
      status === "ERROR" ? "会话错误" :
      status === "STOPPED" ? "会话未启动" : "会话未就绪";
    overlay.appendChild(el("span", "platform-overlay-label", label));
    surface.appendChild(overlay);
  }

  // Capability projection (presentation only): these flags are declaration state,
  // not platform support, production readiness, or operation authorization.
  const caps = state.platform?.capabilities ?? {};
  if (Object.keys(caps).length > 0) {
    const strip = el("div", "platform-capabilities");
    strip.appendChild(el("div", "platform-capabilities-qualifier", PLATFORM_CAPABILITY_QUALIFIER));
    const names: Array<[string, string]> = [
      ["receive_text", "接收消息"], ["send_text", "发送文本"], ["send_image", "发送图片"],
      ["manual_takeover_detection", "人工接管检测"], ["conversation_selection", "会话选择"],
      ["transfer", "转接"], ["product_context", "商品上下文"],
      ["order_context", "订单上下文"], ["desktop_helper", "桌面助手"],
    ];
    for (const [key, label] of names) {
      const declared = caps[key] === true;
      const declarationLabel = capabilityPresentationLabel(state.platform?.platformType ?? null, key, declared);
      const chip = el("span", capabilityPresentationClass(state.platform?.platformType ?? null, key, declared), label + " · " + declarationLabel);
      chip.setAttribute("data-capability", key);
      chip.setAttribute("data-capability-projection", declared ? "declared" : "undeclared");
      strip.appendChild(chip);
    }
    surface.appendChild(strip);
  }

  root.appendChild(surface);

  // Report local bounds so Main can position the seller view. Lifecycle state is
  // local to this surface instance so stale callbacks cannot report after the
  // surface is replaced by a later app-shell render.
  let disposed = false;
  let rafId: number | null = null;
  let observer: ResizeObserver | null = null;
  let lastReportedBounds: { x: number; y: number; width: number; height: number; visible: boolean } | null = null;

  const cleanup = (): void => {
    disposed = true;
    observer?.disconnect();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const report = (): void => {
    if (disposed || !surface.isConnected) {
      cleanup();
      return;
    }
    const rect = surface.getBoundingClientRect();
    const bounds = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      visible: true,
    };
    if (bounds.visible && (bounds.width <= 0 || bounds.height <= 0)) return;
    if (lastReportedBounds
      && lastReportedBounds.x === bounds.x
      && lastReportedBounds.y === bounds.y
      && lastReportedBounds.width === bounds.width
      && lastReportedBounds.height === bounds.height
      && lastReportedBounds.visible === bounds.visible) return;
    actions.onBoundsChange(bounds);
    lastReportedBounds = bounds;
  };

  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      if (disposed || !surface.isConnected) {
        cleanup();
        return;
      }
      report();
    });
    observer.observe(surface);
    // Initial report (also used by the Electron smoke to verify bounds apply).
    rafId = requestAnimationFrame(() => {
      rafId = null;
      report();
    });
  }
}
