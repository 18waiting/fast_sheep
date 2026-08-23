// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { ShopRepository, ShopRecord } from "../repositories/shop-repository.js";
export class InMemoryShopRepository implements ShopRepository {
  private map = new Map<string, ShopRecord>();
  list(): ShopRecord[] { return [...this.map.values()].sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : 1)); }
  add(s: ShopRecord): void { this.map.set(s.id, { ...s }); }
  remove(id: string): void { this.map.delete(id); }
  rename(id: string, name: string): void { const s = this.map.get(id); if (s) s.name = name; }
  reorder(id: string, order: number): void { const s = this.map.get(id); if (s) s.order = order; }
  setEnabled(id: string, enabled: boolean): void { const s = this.map.get(id); if (s) s.enabled = enabled; }
}
