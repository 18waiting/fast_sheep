// M6 window security policy (clean-room). Testable pure configuration.
export const WINDOW_SECURITY = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
} as const;

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'none'",
].join("; ");

export interface WindowPolicyResult {
  webPreferences: { contextIsolation: boolean; nodeIntegration: boolean; sandbox: boolean; webSecurity: boolean; preload?: string };
  csp: string;
  denyExternalNavigation: boolean;
  denyWindowOpen: boolean;
}

export function windowPolicy(preloadPath?: string): WindowPolicyResult {
  return {
    webPreferences: { ...WINDOW_SECURITY, preload: preloadPath },
    csp: CSP,
    denyExternalNavigation: true,
    denyWindowOpen: true,
  };
}

export function isNavigationAllowed(url: string, appOrigin: string): boolean {
  return url.startsWith("file://") && url.startsWith(appOrigin);
}
