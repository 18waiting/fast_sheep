// M8 shared platform navigation policy (clean-room). Production hosts are
// configuration-provided with an EMPTY default; test mode allows local fixtures.
export interface PlatformNavigationPolicyOptions {
  allowedProductionHosts: readonly string[];
  testMode: boolean;
}

export function isPlatformNavigationAllowed(url: string, options: PlatformNavigationPolicyOptions): boolean {
  if (options.testMode) return url.startsWith("file://");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && options.allowedProductionHosts.includes(parsed.hostname);
}

export function isPlatformPopupAllowed(): boolean {
  return false;
}
