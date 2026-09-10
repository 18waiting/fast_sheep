// Main-frame lifecycle adapter for the PDD WebContentsView. This is deliberately
// document-level: in-page navigation and DOM mutations cannot start recovery.
export interface PddDocumentLifecycleObserver {
  onMainFrameNavigationStart(): void;
  onMainFrameDomReady(): void;
  onMainFrameLoadFailure(): void;
}

export interface PddDocumentLifecycleSource {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}

/**
 * Bind the real Electron WebContents lifecycle used for PDD document recovery.
 * `did-start-navigation` is filtered to a new main-frame document, so hash and
 * same-document navigation cannot reset an auth-reauth session.
 */
export function bindPddDocumentLifecycle(
  webContents: PddDocumentLifecycleSource,
  observer: PddDocumentLifecycleObserver,
): void {
  webContents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame === true && isInPlace !== true) observer.onMainFrameNavigationStart();
  });
  webContents.on("dom-ready", () => observer.onMainFrameDomReady());
  webContents.on("did-fail-load", (_event, _code, _description, _url, isMainFrame) => {
    if (isMainFrame === true) observer.onMainFrameLoadFailure();
  });
  webContents.on("render-process-gone", () => observer.onMainFrameLoadFailure());
}
