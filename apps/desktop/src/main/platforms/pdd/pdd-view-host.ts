// M7 PDD view host (clean-room). Owns the Electron WebContentsView for one PDD shop.
// Main owns the view lifecycle; the renderer never owns or touches it.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { WebContentsView } from "electron";
import { partitionFor } from "./pdd-session-partition.js";
import { isPddNavigationAllowed, isPddPopupAllowed, type PddNavigationPolicyOptions } from "./pdd-navigation-policy.js";
import { pddPermissionDecision } from "./pdd-permission-policy.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRELOAD = join(HERE, "..", "..", "..", "platforms", "pdd", "preload.js");
const nodeRequire = createRequire(import.meta.url);

// Lazy electron access: the module must be importable under plain Node for unit
// tests; real WebContentsView is only created in the Electron runtime.
let _WebContentsViewCtor: typeof WebContentsView | null = null;
function webContentsViewCtor(): typeof WebContentsView {
  if (!_WebContentsViewCtor) {
    _WebContentsViewCtor = (nodeRequire("electron") as { WebContentsView: typeof WebContentsView }).WebContentsView;
  }
  return _WebContentsViewCtor;
}

export interface PddViewHostOptions {
  shopId: string;
  testMode: boolean;
  allowedProductionHosts?: readonly string[];
  preloadPath?: string;
}

export interface ViewBounds {
  x: number; y: number; width: number; height: number; visible: boolean;
}

export class PddViewHost {
  readonly webContentsView: WebContentsView;
  private visible = false;
  private readonly nav: PddNavigationPolicyOptions;

  constructor(options: PddViewHostOptions) {
    const partition = partitionFor(options.shopId);
    this.webContentsView = new (webContentsViewCtor())({
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        preload: options.preloadPath ?? DEFAULT_PRELOAD,
      },
    });
    this.nav = {
      allowedProductionHosts: options.allowedProductionHosts ?? [],
      testMode: options.testMode,
    };
    this.webContentsView.webContents.setWindowOpenHandler(({ url }) => {
      return isPddPopupAllowed(url, this.nav) ? { action: "allow" } : { action: "deny" };
    });
    this.webContentsView.webContents.on("will-navigate", (event, url) => {
      if (!isPddNavigationAllowed(url, this.nav)) event.preventDefault();
    });
    this.webContentsView.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(pddPermissionDecision(permission));
    });
  }

  get webContents() {
    return this.webContentsView.webContents;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  loadLocalFixture(fixturePath: string, query?: Record<string, string>): Promise<void> {
    return this.webContentsView.webContents.loadFile(
      fixturePath,
      query ? { search: new URLSearchParams(query).toString() } : {},
    );
  }

  /** Clamp bounds to the main content area and apply. Ignores stale/hidden shops. */
  setBounds(bounds: ViewBounds, contentBounds: ViewBounds): void {
    const clamped = clampBounds(bounds, contentBounds);
    this.webContentsView.setBounds({
      x: clamped.x,
      y: clamped.y,
      width: clamped.width,
      height: clamped.height,
    });
    this.visible = bounds.visible;
    this.webContentsView.setVisible(this.visible);
  }

  show(): void {
    this.visible = true;
    this.webContentsView.setVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.webContentsView.setVisible(false);
  }

  dispose(): void {
    if (!this.webContentsView.webContents.isDestroyed()) {
      this.webContentsView.webContents.close();
    }
  }
}

export function clampBounds(bounds: ViewBounds, contentBounds: ViewBounds): ViewBounds {
  const width = Math.max(0, Math.min(bounds.width, contentBounds.width));
  const height = Math.max(0, Math.min(bounds.height, contentBounds.height));
  const x = Math.max(0, Math.min(bounds.x, Math.max(0, contentBounds.width - width)));
  const y = Math.max(0, Math.min(bounds.y, Math.max(0, contentBounds.height - height)));
  return { x, y, width, height, visible: bounds.visible };
}
