// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
export interface ShopRecord { id: string; type: string; name: string; created_time?: string | null; enabled: boolean; order: number; }
export interface ShopRepository {
  list(): ShopRecord[];
  add(s: ShopRecord): void;
  remove(id: string): void;
  rename(id: string, name: string): void;
  reorder(id: string, order: number): void;
  setEnabled(id: string, enabled: boolean): void;
}
