// M7 PDD navigation policy (clean-room).
// Production allowed hosts are configuration-provided with NO fake default
// (CR-PDD-URL-001); test mode allows local synthetic fixture URLs only.
export interface PddNavigationPolicyOptions {
  allowedProductionHosts: readonly string[];
  testMode: boolean;
}

export function isPddNavigationAllowed(url: string, options: PddNavigationPolicyOptions): boolean {
  if (options.testMode) {
    return url.startsWith("file://");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && options.allowedProductionHosts.includes(parsed.hostname);
}

/** Popups are denied by default; no follow-buyer-links behavior. */
export function isPddPopupAllowed(_url: string, _options: PddNavigationPolicyOptions): boolean {
  return false;
}
