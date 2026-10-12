import { test } from "node:test";
import assert from "node:assert/strict";
import { PlatformSessionCoordinator } from "../dist/main/platforms/platform-session-coordinator.js";
import { PddPlatformService } from "../dist/main/platforms/pdd/pdd-platform-service.js";

const bounds = { x: 10, y: 20, width: 300, height: 200, visible: true };
const content = { x: 0, y: 0, width: 800, height: 600, visible: true };
const orchestrator = { onBuyerMessage: async () => {}, onHumanTakeover: async () => {}, onFocusShop: () => {} } as never;

class FakeView {
  visible = false;
  disposed = false;
  boundsCalls = 0;
  readonly webContents = { send: () => {}, isDestroyed: () => this.disposed };
  private readonly load: () => Promise<void>;
  constructor(load: () => Promise<void> = async () => {}) { this.load = load; }
  loadLocalFixture(): Promise<void> { return this.load(); }
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  setBounds(b: typeof bounds): void { this.boundsCalls++; this.visible = b.visible; }
  dispose(): void { this.visible = false; this.disposed = true; }
  get isVisible(): boolean { return this.visible; }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

function harness(loadFor?: (shopId: string) => Promise<void>) {
  const coordinator = new PlatformSessionCoordinator();
  const pddViews = new Map<string, FakeView>();
  const pdd = new PddPlatformService({
    navigationMode: "FIXTURE", orchestrator,
    fixturePathFor: (shopId) => `/synthetic/${shopId}.html`,
    makeView: (shopId) => {
      const view = new FakeView(() => loadFor?.(shopId) ?? Promise.resolve());
      pddViews.set(shopId, view);
      return view as never;
    },
  });
  coordinator.register("pdd", pdd);
  return { coordinator, pdd, pddViews };
}

test("A -> B hides old native view, preserves old session, rejects inactive visible bounds", async () => {
  const h = harness();
  await h.coordinator.activateShop("pdd", "a");
  assert.equal(h.coordinator.setViewBounds("pdd", "a", bounds, content), true);
  await h.coordinator.activateShop("pdd", "b");
  assert.equal(h.pddViews.get("a")?.visible, false);
  assert.equal(h.pddViews.get("b")?.visible, true);
  assert.ok(h.pdd.status("a"), "old session remains owned and available for ingress");
  assert.equal(h.coordinator.setViewBounds("pdd", "a", bounds, content), false);
  assert.equal(h.pdd.setViewBounds("a", bounds, content), false);
  assert.equal(h.pddViews.get("a")?.boundsCalls, 1);
  assert.equal(h.coordinator.setViewBounds("pdd", "b", bounds, content), true);
  h.coordinator.disposeAll();
  assert.equal(h.pddViews.get("a")?.disposed, true);
  assert.equal(h.pddViews.get("b")?.disposed, true);
  assert.equal(h.coordinator.setViewBounds("pdd", "b", bounds, content), false);
});

// FastWork realignment B3: PDD-only MVP. The property formerly proven across two
// platform hosts is now proven as "the coordinator holds exactly one canonical
// host, and a non-canonical platform can never take or steal the visual target".
test("visual target is PDD-only: a non-canonical platform cannot take or steal it", async () => {
  const h = harness();
  await h.coordinator.activateShop("pdd", "a");
  assert.equal(h.coordinator.setViewBounds("pdd", "a", bounds, content), true);
  assert.equal(await h.coordinator.activateShop("jd" as never, "j1"), false, "unregistered platform host -> activation refused");
  assert.equal(h.coordinator.setViewBounds("jd" as never, "j1", bounds, content), false);
  // The refused activation must leave the live PDD target completely untouched.
  assert.equal(h.pddViews.get("a")?.visible, true);
  assert.equal(h.coordinator.setViewBounds("pdd", "a", bounds, content), true);
  // A second PDD shop still supersedes the first through the same single target.
  await h.coordinator.activateShop("pdd", "b");
  assert.equal(h.pddViews.get("a")?.visible, false);
  assert.equal(h.pddViews.get("b")?.visible, true);
  h.coordinator.disposeAll();
});

test("late A load cannot re-show after B; late bounds are rejected", async () => {
  const a = deferred();
  const h = harness((shopId) => shopId === "a" ? a.promise : Promise.resolve());
  const pendingA = h.coordinator.activateShop("pdd", "a");
  await h.coordinator.activateShop("pdd", "b");
  a.resolve();
  assert.equal(await pendingA, false);
  assert.equal(h.pddViews.get("a")?.visible, false);
  assert.equal(h.pddViews.get("b")?.visible, true);
  assert.equal(h.coordinator.setViewBounds("pdd", "a", bounds, content), false);
  h.coordinator.disposeAll();
});

test("hidden bounds close invalidates a pending activation without disposing its session", async () => {
  const a = deferred();
  const h = harness(() => a.promise);
  const pending = h.coordinator.activateShop("pdd", "a");
  assert.equal(h.coordinator.setViewBounds("pdd", "a", { ...bounds, visible: false }, content), true);
  a.resolve();
  assert.equal(await pending, false);
  assert.equal(h.pddViews.get("a")?.visible, false);
  assert.ok(h.pdd.status("a"));
  assert.equal(h.coordinator.setViewBounds("pdd", "a", bounds, content), false);
  assert.equal(await h.coordinator.activateShop("pdd", "a"), true);
  assert.equal(h.pddViews.get("a")?.visible, true);
  h.coordinator.disposeAll();
});

test("login-required state remains projected on the active fallback view", async () => {
  const h = harness();
  await h.coordinator.activateShop("pdd", "a");
  h.pdd.handlePageEvent({ event: "login_required", session_id: "pdd-session-a", shop_id: "a" });
  assert.equal(h.coordinator.status("pdd", "a")?.session_status, "LOGIN_REQUIRED");
  assert.equal(h.coordinator.status("pdd", "a")?.view_visible, true);
  h.coordinator.disposeAll();
});
