// M7 PDD navigation policy (clean-room).
// Production routes are exact origin + pathname matches. Query strings and
// fragments are deliberately ignored for route identity.
export type PddNavigationMode = "FIXTURE" | "PRODUCTION_READ_ONLY";
export type PddRouteKind = "FIXTURE" | "LOGIN" | "CHAT" | "BLOCKED";

export const PDD_TOP_LEVEL_HOST = "mms.pinduoduo.com";
export const PDD_LOGIN_PATH = "/login/";
export const PDD_CHAT_PATH = "/chat-merchant/index.html";
export const PDD_PRODUCTION_ORIGIN = "https://" + PDD_TOP_LEVEL_HOST;
export const PDD_PRODUCTION_LOGIN_URL = PDD_PRODUCTION_ORIGIN + PDD_LOGIN_PATH;
export const PDD_PRODUCTION_CHAT_URL = PDD_PRODUCTION_ORIGIN + PDD_CHAT_PATH;

export interface PddNavigationPolicyOptions {
  allowedProductionHosts?: readonly string[];
  navigationMode: PddNavigationMode;
}

export interface PddInteractionPolicy {
  pointerInputEnabled: boolean;
  keyboardInputEnabled: boolean;
  mutationCommandsEnabled: boolean;
}

export function classifyPddNavigation(url: string, options: PddNavigationPolicyOptions): PddRouteKind {
  if (options.navigationMode !== "FIXTURE" && options.navigationMode !== "PRODUCTION_READ_ONLY") return "BLOCKED";
  if (options.navigationMode === "FIXTURE") {
    return url.startsWith("file://") ? "FIXTURE" : "BLOCKED";
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "BLOCKED";
  }
  if (parsed.protocol !== "https:") return "BLOCKED";
  if (!(options.allowedProductionHosts ?? []).includes(parsed.hostname)) return "BLOCKED";
  if (parsed.pathname === PDD_LOGIN_PATH) return "LOGIN";
  if (parsed.pathname === PDD_CHAT_PATH) return "CHAT";
  return "BLOCKED";
}

export function isPddNavigationAllowed(url: string, options: PddNavigationPolicyOptions): boolean {
  return classifyPddNavigation(url, options) !== "BLOCKED";
}

/** Popups are denied by default; no follow-buyer-links behavior. */
export function isPddPopupAllowed(_url: string, _options: PddNavigationPolicyOptions): boolean {
  return false;
}

export function interactionPolicyForRoute(route: PddRouteKind): PddInteractionPolicy {
  if (route === "FIXTURE") {
    return { pointerInputEnabled: true, keyboardInputEnabled: true, mutationCommandsEnabled: true };
  }
  if (route === "LOGIN") {
    return { pointerInputEnabled: true, keyboardInputEnabled: true, mutationCommandsEnabled: false };
  }
  return { pointerInputEnabled: false, keyboardInputEnabled: false, mutationCommandsEnabled: false };
}
