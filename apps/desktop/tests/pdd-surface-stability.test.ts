import { test } from "node:test";
import assert from "node:assert/strict";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";
import { renderPlatformSurface } from "../dist/renderer/components/platform-surface.js";

class FakeElement {
  tagName: string;
  children: FakeElement[] = [];
  parentNode: FakeElement | null = null;
  attributes: Record<string, string> = {};
  textContent = "";
  connected = false;
  rect = { left: 0, top: 0, width: 0, height: 0 };
  private _className = "";

  constructor(tag: string) { this.tagName = tag.toUpperCase(); }
  get className(): string { return this._className; }
  set className(value: string) { this._className = value; }
  get firstChild(): FakeElement | null { return this.children[0] ?? null; }
  get isConnected(): boolean { return this.connected; }
  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    child.parentNode = this;
    child.connected = this.connected;
    return child;
  }
  removeChild(child: FakeElement): FakeElement {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    child.connected = false;
    return child;
  }
  setAttribute(key: string, value: string): void { this.attributes[key] = value; }
  getBoundingClientRect(): { left: number; top: number; width: number; height: number } { return this.rect; }
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: () => void;
  disconnected = false;
  observed: FakeElement[] = [];

  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(target: FakeElement): void { this.observed.push(target); }
  disconnect(): void { this.disconnected = true; }
  trigger(): void { this.callback(); }
}

const rafCallbacks = new Map<number, (time: number) => void>();
const cancelledRafs: number[] = [];
let nextRafId = 1;

(globalThis as Record<string, unknown>).document = {
  createElement: (tag: string) => new FakeElement(tag),
};
(globalThis as Record<string, unknown>).ResizeObserver = FakeResizeObserver;
(globalThis as Record<string, unknown>).requestAnimationFrame = (callback: (time: number) => void): number => {
  const id = nextRafId++;
  rafCallbacks.set(id, callback);
  return id;
};
(globalThis as Record<string, unknown>).cancelAnimationFrame = (id: number): void => {
  rafCallbacks.delete(id);
  cancelledRafs.push(id);
};

function resetFakeRuntime(): void {
  FakeResizeObserver.instances = [];
  rafCallbacks.clear();
  cancelledRafs.length = 0;
  nextRafId = 1;
}

function findByClass(root: FakeElement, className: string): FakeElement[] {
  const found: FakeElement[] = [];
  const walk = (node: FakeElement): void => {
    if (node.className.split(/\s+/).includes(className)) found.push(node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return found;
}

function makeRoot(): FakeElement {
  const root = new FakeElement("div");
  root.connected = true;
  return root;
}

function makeSurfaceState(): never {
  return {
    platform: {
      activeShopId: "shop-1",
      platformType: "pdd",
      sessionStatus: "READY",
      viewVisible: true,
      lastSafeError: null,
      capabilities: {},
    },
  } as never;
}

function mountSurface(root: FakeElement, onBoundsChange: (bounds: { x: number; y: number; width: number; height: number; visible: boolean }) => void) {
  renderPlatformSurface(root, makeSurfaceState(), { onBoundsChange });
  const surface = findByClass(root, "platform-surface")[0];
  const observer = FakeResizeObserver.instances.at(-1) ?? null;
  const rafId = [...rafCallbacks.keys()].at(-1) ?? null;
  return { surface, observer, rafId };
}

class FakeServiceView {
  visible = false;
  bounds: Array<Record<string, number | boolean>> = [];
  fixture: string | null = null;
  webContents = {
    send: () => {},
    isDestroyed: () => false,
  };
  async loadLocalFixture(path: string): Promise<void> { this.fixture = path; }
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  setBounds(bounds: Record<string, number | boolean>): void { this.bounds.push(bounds); }
  dispose(): void {}
  get isVisible(): boolean { return this.visible; }
}

function makeService(statusEvents: Array<Record<string, unknown>>) {
  const views = new Map<string, FakeServiceView>();
  const service = new PddPlatformService({
    navigationMode: "FIXTURE",
    orchestrator: { onBuyerMessage: async () => undefined, onHumanTakeover: async () => undefined, onFocusShop: () => undefined } as never,
    fixturePathFor: (shopId) => "/fixtures/" + shopId + ".html",
    makeView: (shopId: string) => {
      const view = new FakeServiceView();
      views.set(shopId, view);
      return view as never;
    },
    onStatusChanged: (event) => statusEvents.push(event as never),
    revision: () => 1,
  });
  return { service, views };
}

test("setViewBounds applies geometry without emitting a status broadcast; genuine transitions still broadcast", async () => {
  const statusEvents: Array<Record<string, unknown>> = [];
  const { service, views } = makeService(statusEvents);
  await service.activate("shop-1");
  const activationEvents = statusEvents.length;
  service.setViewBounds("shop-1", { x: 10, y: 20, width: 300, height: 200, visible: true }, { x: 0, y: 0, width: 1000, height: 800 });
  assert.equal(statusEvents.length, activationEvents, "bounds-only update must not broadcast status");
  assert.deepEqual(views.get("shop-1")?.bounds.at(-1), { x: 10, y: 20, width: 300, height: 200, visible: true });

  service.handlePageEvent({ event: "page_ready", session_id: "pdd-session-shop-1", shop_id: "shop-1" } as never);
  const afterPage = statusEvents.length;
  assert.ok(afterPage > activationEvents, "page status transition must still broadcast");
  await service.reload("shop-1");
  assert.ok(statusEvents.length > afterPage, "reload status transition must still broadcast");
});

test("detached surface callback cannot report and disconnects its observer", () => {
  resetFakeRuntime();
  const reports: Array<Record<string, number | boolean>> = [];
  const root = makeRoot();
  const { surface, observer } = mountSurface(root, (bounds) => reports.push(bounds));
  assert.ok(surface && observer);
  surface.rect = { left: 5, top: 6, width: 300, height: 200 };
  root.removeChild(surface);
  observer.trigger();
  assert.equal(reports.length, 0);
  assert.equal(observer.disconnected, true);
});

test("stale requestAnimationFrame callback cannot report", () => {
  resetFakeRuntime();
  const reports: Array<Record<string, number | boolean>> = [];
  const root = makeRoot();
  const { surface, observer, rafId } = mountSurface(root, (bounds) => reports.push(bounds));
  assert.ok(surface && observer && rafId !== null);
  surface.rect = { left: 5, top: 6, width: 300, height: 200 };
  root.removeChild(surface);
  rafCallbacks.get(rafId)!(0);
  assert.equal(reports.length, 0);
  assert.equal(observer.disconnected, true);
});

test("stale ResizeObserver callback cannot report", () => {
  resetFakeRuntime();
  const reports: Array<Record<string, number | boolean>> = [];
  const root = makeRoot();
  const { surface, observer } = mountSurface(root, (bounds) => reports.push(bounds));
  assert.ok(surface && observer);
  surface.rect = { left: 5, top: 6, width: 300, height: 200 };
  root.removeChild(surface);
  observer.trigger();
  assert.equal(reports.length, 0);
  assert.equal(observer.disconnected, true);
});

test("old surface cannot report after a new surface replaces it", () => {
  resetFakeRuntime();
  const reports: Array<Record<string, number | boolean>> = [];
  const root = makeRoot();
  const first = mountSurface(root, (bounds) => reports.push(bounds));
  assert.ok(first.surface && first.observer && first.rafId !== null);
  first.surface.rect = { left: 5, top: 6, width: 300, height: 200 };
  root.removeChild(first.surface);
  const oldRaf = rafCallbacks.get(first.rafId)!;
  const second = mountSurface(root, (bounds) => reports.push(bounds));
  assert.ok(second.surface && second.observer && second.rafId !== null);
  second.surface.rect = { left: 5, top: 6, width: 300, height: 200 };
  oldRaf(0);
  first.observer.trigger();
  assert.equal(reports.length, 0, "old surface callbacks must not report");
  rafCallbacks.get(second.rafId)!(0);
  assert.equal(reports.length, 1, "new surface must report its first valid bounds");
});

test("non-positive visible geometry is rejected and valid geometry is reported", () => {
  resetFakeRuntime();
  const reports: Array<Record<string, number | boolean>> = [];
  const root = makeRoot();
  const { surface, rafId } = mountSurface(root, (bounds) => reports.push(bounds));
  assert.ok(surface && rafId !== null);
  surface.rect = { left: 10, top: 20, width: 0, height: 200 };
  rafCallbacks.get(rafId)!(0);
  assert.equal(reports.length, 0, "zero width must not report");

  const heightRoot = makeRoot();
  const heightSurface = mountSurface(heightRoot, (bounds) => reports.push(bounds));
  assert.ok(heightSurface.surface && heightSurface.rafId !== null);
  heightSurface.surface.rect = { left: 10, top: 20, width: 300, height: 0 };
  rafCallbacks.get(heightSurface.rafId)!(0);
  assert.equal(reports.length, 0, "zero height must not report");

  const validRoot = makeRoot();
  const validSurface = mountSurface(validRoot, (bounds) => reports.push(bounds));
  assert.ok(validSurface.surface && validSurface.rafId !== null);
  validSurface.surface.rect = { left: 10, top: 20, width: 300, height: 200 };
  rafCallbacks.get(validSurface.rafId)!(0);
  assert.deepEqual(reports, [{ x: 10, y: 20, width: 300, height: 200, visible: true }]);
});

test("identical normalized bounds are deduplicated; changed and new-surface bounds are reported", () => {
  resetFakeRuntime();
  const reports: Array<Record<string, number | boolean>> = [];
  const root = makeRoot();
  const { surface, observer, rafId } = mountSurface(root, (bounds) => reports.push(bounds));
  assert.ok(surface && observer && rafId !== null);
  surface.rect = { left: 10, top: 20, width: 300, height: 200 };
  rafCallbacks.get(rafId)!(0);
  observer.trigger();
  assert.equal(reports.length, 1, "identical normalized bounds report once");
  surface.rect = { left: 11, top: 20, width: 300, height: 200 };
  observer.trigger();
  assert.equal(reports.length, 2, "changed bounds report again");

  const nextRoot = makeRoot();
  const nextSurface = mountSurface(nextRoot, (bounds) => reports.push(bounds));
  assert.ok(nextSurface.surface && nextSurface.rafId !== null);
  nextSurface.surface.rect = { left: 11, top: 20, width: 300, height: 200 };
  rafCallbacks.get(nextSurface.rafId)!(0);
  assert.equal(reports.length, 3, "new surface instance reports its first valid bounds");
});

test("failed bounds delivery does not poison dedup state", () => {
  resetFakeRuntime();
  let calls = 0;
  let shouldThrow = true;
  const root = makeRoot();
  const { surface, observer, rafId } = mountSurface(root, () => {
    calls += 1;
    if (shouldThrow) {
      shouldThrow = false;
      throw new Error("delivery failed");
    }
  });
  assert.ok(surface && observer && rafId !== null);
  surface.rect = { left: 10, top: 20, width: 300, height: 200 };
  assert.throws(() => rafCallbacks.get(rafId)!(0));
  assert.equal(calls, 1);
  observer.trigger();
  assert.equal(calls, 2, "same bounds are retried after a failed delivery");
});
