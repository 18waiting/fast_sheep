// M8 generic platform view host (clean-room). Main-owned WebContentsView for one
// shop of a web platform. Lazy electron for Node testability.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { WebContentsView } from "electron";
import { platformPartitionFor } from "./platform-session-partition.js";
import { isPlatformNavigationAllowed, isPlatformPopupAllowed, type PlatformNavigationPolicyOptions } from "./platform-navigation-policy.js";
import { platformPermissionDecision } from "./platform-permission-policy.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
let _Ctor: typeof WebContentsView | null = null;
function ctor(): typeof WebContentsView {
  if (!_Ctor) _Ctor = (nodeRequire("electron") as { WebContentsView: typeof WebContentsView }).WebContentsView;
  return _Ctor;
}

export interface ViewBounds {
  x: number; y: number; width: number; height: number; visible: boolean;
}

export interface GenericViewHostOptions {
  platform: string;
  shopId: string;
  testMode: boolean;
  preloadPath: string;
  allowedProductionHosts?: readonly string[];
}

export class GenericViewHost {
  readonly webContentsView: WebContentsView;
  private visible = false;
  private readonly nav: PlatformNavigationPolicyOptions;

  constructor(options: GenericViewHostOptions) {
    const partition = platformPartitionFor(options.shopId);
    this.webContentsView = new (ctor())({
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        preload: options.preloadPath,
      },
    });
    // Native visibility must agree with the initial hidden state before load.
    this.webContentsView.setVisible(false);
    this.nav = { allowedProductionHosts: options.allowedProductionHosts ?? [], testMode: options.testMode };
    this.webContentsView.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.webContentsView.webContents.on("will-navigate", (event, url) => {
      if (!isPlatformNavigationAllowed(url, this.nav)) event.preventDefault();
    });
    this.webContentsView.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(platformPermissionDecision(permission));
    });
  }

  get webContents() {
    return this.webContentsView.webContents;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  loadLocalFixture(fixturePath: string, query?: Record<string, string>): Promise<void> {
    return this.webContentsView.webContents.loadFile(fixturePath, query ? { search: new URLSearchParams(query).toString() } : {});
  }

  setBounds(bounds: ViewBounds, contentBounds: ViewBounds): void {
    const clamped = clampBounds(bounds, contentBounds);
    this.webContentsView.setBounds({ x: clamped.x, y: clamped.y, width: clamped.width, height: clamped.height });
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
    if (!this.webContentsView.webContents.isDestroyed()) this.webContentsView.webContents.close();
  }
}

export function clampBounds(bounds: ViewBounds, contentBounds: ViewBounds): ViewBounds {
  const width = Math.max(0, Math.min(bounds.width, contentBounds.width));
  const height = Math.max(0, Math.min(bounds.height, contentBounds.height));
  const x = Math.max(0, Math.min(bounds.x, Math.max(0, contentBounds.width - width)));
  const y = Math.max(0, Math.min(bounds.y, Math.max(0, contentBounds.height - height)));
  return { x, y, width, height, visible: bounds.visible };
}
