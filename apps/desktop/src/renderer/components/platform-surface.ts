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

  // Report local bounds so Main can position the seller view.
  if (typeof ResizeObserver !== "undefined") {
    const report = (): void => {
      const rect = surface.getBoundingClientRect();
      actions.onBoundsChange({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible: true,
      });
    };
    const ro = new ResizeObserver(() => report());
    ro.observe(surface);
    // Initial report (also used by the Electron smoke to verify bounds apply).
    requestAnimationFrame(() => report());
  }

  // Capability projection (presentation only): unsupported controls are disabled.
  const caps = state.platform?.capabilities ?? {};
  if (Object.keys(caps).length > 0) {
    const strip = el("div", "platform-capabilities");
    const names: Array<[string, string]> = [
      ["receive_text", "接收消息"], ["send_text", "发送文本"], ["send_image", "发送图片"],
      ["manual_takeover_detection", "人工接管检测"], ["conversation_selection", "会话选择"],
      ["transfer", "转接"], ["desktop_helper", "桌面助手"],
    ];
    for (const [key, label] of names) {
      const supported = caps[key] === true;
      const chip = el("span", supported ? "cap-chip supported" : "cap-chip unsupported", label);
      chip.setAttribute("data-capability", key);
      chip.setAttribute("data-supported", supported ? "true" : "false");
      strip.appendChild(chip);
    }
    surface.appendChild(strip);
  }

  root.appendChild(surface);
}
