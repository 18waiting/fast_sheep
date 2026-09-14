// M7 PDD view host (clean-room). Owns the Electron WebContentsView for one PDD shop.
// Main owns the view lifecycle; the renderer never owns or touches it.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { WebContentsView } from "electron";
import { partitionFor } from "./pdd-session-partition.js";
import {
  classifyPddNavigation,
  interactionPolicyForRoute,
  isPddPopupAllowed,
  type PddNavigationMode,
  type PddNavigationPolicyOptions,
  type PddRouteKind,
} from "./pdd-navigation-policy.js";
import { pddPermissionDecision } from "./pdd-permission-policy.js";
import { bindPddDocumentLifecycle, type PddDocumentLifecycleObserver } from "./pdd-document-lifecycle.js";

export const PDD_PAGE_LIFECYCLE_START_CHANNEL = "pdd-page-lifecycle-start";

export interface PddDocumentObservation {
  session_id: string;
  shop_id: string;
  document_generation: number;
}

export interface PddRouteDecision {
  route: PddRouteKind;
  url: string | null;
}

export interface PddViewAttachment {
  removeChildView(view: WebContentsView): void;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRELOAD = join(HERE, "..", "..", "..", "platforms", "pdd", "preload.js");
const READ_ONLY_SHIELD_HTML = "data:text/html;charset=utf-8," + encodeURIComponent(
  "<!doctype html><html><head><meta charset=\"utf-8\"><style>html,body{margin:0;width:100%;height:100%;background:transparent;}</style></head><body></body></html>",
);
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

function defaultAttachViews(pddView: WebContentsView, shieldView: WebContentsView): PddViewAttachment {
  const electron = nodeRequire("electron") as {
    BrowserWindow: { getAllWindows(): Array<{ isDestroyed(): boolean; contentView: { addChildView(view: WebContentsView): void; removeChildView(view: WebContentsView): void } }> };
  };
  const window = electron.BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
  if (!window) throw new Error("PDD view attachment requires an application window");
  window.contentView.addChildView(pddView);
  window.contentView.addChildView(shieldView);
  return { removeChildView: (view) => window.contentView.removeChildView(view) };
}

export interface PddViewHostOptions {
  shopId: string;
  navigationMode: PddNavigationMode;
  allowedProductionHosts?: readonly string[];
  productionEntryUrl?: string;
  preloadPath?: string;
  onRouteClassified?: (decision: PddRouteDecision) => void;
  attachViews?: (pddView: WebContentsView, shieldView: WebContentsView) => PddViewAttachment;
  createView?: () => WebContentsView;
  createShieldView?: () => WebContentsView;
}

export interface ViewBounds {
  x: number; y: number; width: number; height: number; visible: boolean;
}

export class PddViewHost {
  readonly webContentsView: WebContentsView;
  private readonly readOnlyShieldView: WebContentsView;
  private visible = false;
  private readonly nav: PddNavigationPolicyOptions;
  private readonly navigationMode: PddNavigationMode;
  private readonly productionEntryUrl: string | undefined;
  private readonly attachment: PddViewAttachment;
  private onRouteClassified: ((decision: PddRouteDecision) => void) | undefined;
  private routeKind: PddRouteKind;
  private readOnlyInteractionActive: boolean;
  private protectedBounds: ViewBounds | null = null;
  private documentLifecycleObserver: PddDocumentLifecycleObserver | null = null;

  constructor(options: PddViewHostOptions) {
    if (options.navigationMode !== "FIXTURE" && options.navigationMode !== "PRODUCTION_READ_ONLY") {
      throw new Error("navigationMode is required");
    }
    const partition = partitionFor(options.shopId);
    this.navigationMode = options.navigationMode;
    this.productionEntryUrl = options.productionEntryUrl;
    this.onRouteClassified = options.onRouteClassified;
    this.routeKind = this.navigationMode === "FIXTURE" ? "FIXTURE" : "BLOCKED";
    this.readOnlyInteractionActive = this.navigationMode !== "FIXTURE";
    this.webContentsView = options.createView?.() ?? new (webContentsViewCtor())({
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        preload: options.preloadPath ?? DEFAULT_PRELOAD,
      },
    });
    this.readOnlyShieldView = options.createShieldView?.() ?? new (webContentsViewCtor())({
      webPreferences: {
        partition: "memory:pdd-read-only-shield-" + options.shopId.replace(/[^A-Za-z0-9._-]/g, "_"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    this.readOnlyShieldView.setBackgroundColor("#00000000");
    this.readOnlyShieldView.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.readOnlyShieldView.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    try {
      this.attachment = (options.attachViews ?? defaultAttachViews)(this.webContentsView, this.readOnlyShieldView);
    } catch (error) {
      this.webContentsView.webContents.close();
      this.readOnlyShieldView.webContents.close();
      throw error;
    }
    void this.readOnlyShieldView.webContents.loadURL(READ_ONLY_SHIELD_HTML);
    this.applyReadOnlyShield();
    this.nav = {
      allowedProductionHosts: options.allowedProductionHosts ?? [],
      navigationMode: this.navigationMode,
    };
    this.webContentsView.webContents.setWindowOpenHandler(({ url }) => {
      return isPddPopupAllowed(url, this.nav) ? { action: "allow" } : { action: "deny" };
    });
    this.webContentsView.webContents.on("will-navigate", (event, url, _isInPlace, isMainFrame) => {
      if (isMainFrame !== false) this.handleNavigation(event, url);
    });
    this.webContentsView.webContents.on("will-redirect", (event, url, _isInPlace, isMainFrame) => {
      if (isMainFrame !== false) this.handleNavigation(event, url);
    });
    this.webContentsView.webContents.on("before-input-event", (event) => {
      if (this.readOnlyInteractionActive) event.preventDefault();
    });
    this.webContentsView.webContents.on("before-mouse-event", (event) => {
      if (this.readOnlyInteractionActive) event.preventDefault();
    });
    this.webContentsView.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(pddPermissionDecision(permission));
    });
    bindPddDocumentLifecycle(this.webContentsView.webContents, {
      onMainFrameNavigationStart: () => this.documentLifecycleObserver?.onMainFrameNavigationStart(),
      onMainFrameDomReady: () => this.documentLifecycleObserver?.onMainFrameDomReady(),
      onMainFrameLoadFailure: () => this.documentLifecycleObserver?.onMainFrameLoadFailure(),
    });
  }

  get webContents() {
    return this.webContentsView.webContents;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  get currentRouteKind(): PddRouteKind {
    return this.routeKind;
  }

  get isReadOnlyInteractionActive(): boolean {
    return this.readOnlyInteractionActive;
  }

  get mutationCommandsEnabled(): boolean {
    return interactionPolicyForRoute(this.routeKind).mutationCommandsEnabled;
  }

  setRouteDecisionHandler(handler: ((decision: PddRouteDecision) => void) | null): void {
    this.onRouteClassified = handler ?? undefined;
  }

  private handleNavigation(event: { preventDefault(): void }, url: string): void {
    const route = classifyPddNavigation(url, this.nav);
    if (route === "BLOCKED") {
      event.preventDefault();
      this.setRoute("BLOCKED", url);
      return;
    }
    this.setRoute(route, url);
  }

  private setRoute(route: PddRouteKind, url: string | null): void {
    this.routeKind = route;
    this.readOnlyInteractionActive = !interactionPolicyForRoute(route).pointerInputEnabled;
    this.applyReadOnlyShield();
    this.onRouteClassified?.({ route, url });
  }

  private applyReadOnlyShield(): void {
    this.readOnlyShieldView.setVisible(this.visible && this.readOnlyInteractionActive);
  }

  loadLocalFixture(fixturePath: string, query?: Record<string, string>): Promise<void> {
    if (this.navigationMode !== "FIXTURE") {
      return Promise.reject(new Error("fixture navigation is unavailable in production mode"));
    }
    this.setRoute("FIXTURE", null);
    return this.webContentsView.webContents.loadFile(
      fixturePath,
      query ? { search: new URLSearchParams(query).toString() } : {},
    );
  }

  loadProductionEntry(url: string | undefined = this.productionEntryUrl): Promise<void> {
    if (this.navigationMode !== "PRODUCTION_READ_ONLY") {
      return Promise.reject(new Error("production navigation is unavailable in fixture mode"));
    }
    if (!url) return Promise.reject(new Error("production entry URL is required"));
    const route = classifyPddNavigation(url, this.nav);
    if (route !== "CHAT") return Promise.reject(new Error("production entry route is not allowed"));
    this.setRoute(route, url);
    return this.webContentsView.webContents.loadURL(url);
  }

  setDocumentLifecycleObserver(observer: PddDocumentLifecycleObserver | null): void {
    this.documentLifecycleObserver = observer;
  }

  startDocumentObservation(observation: PddDocumentObservation): void {
    if (!this.webContents.isDestroyed()) {
      this.webContents.send(PDD_PAGE_LIFECYCLE_START_CHANNEL, observation);
    }
  }

  /** Clamp bounds to the main content area and apply. Ignores stale/hidden shops. */
  setBounds(bounds: ViewBounds, contentBounds: ViewBounds): void {
    const clamped = clampBounds(bounds, contentBounds);
    const nextBounds = {
      x: clamped.x,
      y: clamped.y,
      width: clamped.width,
      height: clamped.height,
      visible: clamped.visible,
    };
    if (this.protectedBounds === null) {
      this.readOnlyShieldView.setBounds(nextBounds);
      this.webContentsView.setBounds(nextBounds);
    } else {
      const coverage = unionBounds(this.protectedBounds, nextBounds);
      this.readOnlyShieldView.setBounds(coverage);
      this.webContentsView.setBounds(nextBounds);
      this.readOnlyShieldView.setBounds(nextBounds);
    }
    this.protectedBounds = nextBounds;
    this.visible = bounds.visible;
    this.webContentsView.setVisible(this.visible);
    this.applyReadOnlyShield();
  }

  show(): void {
    this.visible = true;
    this.webContentsView.setVisible(true);
    this.applyReadOnlyShield();
  }

  hide(): void {
    this.visible = false;
    this.webContentsView.setVisible(false);
    this.applyReadOnlyShield();
  }

  dispose(): void {
    this.readOnlyInteractionActive = true;
    this.routeKind = "BLOCKED";
    try {
      this.attachment.removeChildView(this.readOnlyShieldView);
      this.attachment.removeChildView(this.webContentsView);
    } catch {
      // Disposal is best-effort; closing WebContents remains mandatory.
    }
    if (!this.webContentsView.webContents.isDestroyed()) {
      this.webContentsView.webContents.close();
    }
    if (!this.readOnlyShieldView.webContents.isDestroyed()) {
      this.readOnlyShieldView.webContents.close();
    }
  }
}

function unionBounds(a: ViewBounds | null, b: ViewBounds): ViewBounds {
  if (a === null) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y, visible: a.visible || b.visible };
}

export function clampBounds(bounds: ViewBounds, contentBounds: ViewBounds): ViewBounds {
  const width = Math.max(0, Math.min(bounds.width, contentBounds.width));
  const height = Math.max(0, Math.min(bounds.height, contentBounds.height));
  const x = Math.max(0, Math.min(bounds.x, Math.max(0, contentBounds.width - width)));
  const y = Math.max(0, Math.min(bounds.y, Math.max(0, contentBounds.height - height)));
  return { x, y, width, height, visible: bounds.visible };
}
