// M8 platform session coordinator (clean-room). Creates/gets/disposes shop
// sessions across platforms, activates shops, applies view bounds, projects
// status, and isolates sessions. No platform DOM knowledge.
import type { PlatformId } from "./platform-host-registry.js";
import type { PlatformHostService } from "./platform-host-registry.js";

export interface SessionCoordinatorEntry {
  platform: PlatformId;
  service: PlatformHostService;
}

export interface StatusView {
  shop_id: string;
  platform: string;
  session_status: string;
  view_visible: boolean;
  last_error?: string;
  capabilities?: Record<string, unknown>;
}

export class PlatformSessionCoordinator {
  private readonly services = new Map<PlatformId, PlatformHostService>();

  register(platform: PlatformId, service: PlatformHostService): void {
    this.services.set(platform, service);
  }

  serviceFor(platform: PlatformId): PlatformHostService | null {
    return this.services.get(platform) ?? null;
  }

  async activateShop(platform: PlatformId, shopId: string): Promise<boolean> {
    const service = this.services.get(platform);
    if (!service) return false;
    await (service as { activate(shopId: string): Promise<void> }).activate(shopId);
    return true;
  }

  status(platform: PlatformId, shopId: string): StatusView | null {
    const service = this.services.get(platform);
    if (!service) return null;
    return (service as { status(shopId: string): StatusView | null }).status(shopId);
  }

  setViewBounds(platform: PlatformId, shopId: string, bounds: { x: number; y: number; width: number; height: number; visible: boolean }, content: { x: number; y: number; width: number; height: number; visible: boolean }): boolean {
    const service = this.services.get(platform);
    if (!service) return false;
    return (service as { setViewBounds(shopId: string, b: typeof bounds, c: typeof content): boolean }).setViewBounds(shopId, bounds, content);
  }

  async reload(platform: PlatformId, shopId: string): Promise<boolean> {
    const service = this.services.get(platform);
    if (!service) return false;
    return (service as { reload(shopId: string): Promise<boolean> }).reload(shopId);
  }

  isTrustedWebContents(platform: PlatformId, wc: unknown): boolean {
    const service = this.services.get(platform);
    if (!service) return false;
    return (service as { isTrustedWebContents(wc: unknown): boolean }).isTrustedWebContents(wc);
  }

  handlePageEvent(platform: PlatformId, payload: unknown): void {
    this.services.get(platform)?.handlePageEvent(payload);
  }

  handleCommandResult(platform: PlatformId, payload: unknown): void {
    this.services.get(platform)?.handleCommandResult(payload);
  }

  disposeAll(): void {
    for (const service of this.services.values()) {
      (service as { disposeAll(): void }).disposeAll();
    }
    this.services.clear();
  }

  entries(): SessionCoordinatorEntry[] {
    return [...this.services.entries()].map(([platform, service]) => ({ platform, service }));
  }
}
