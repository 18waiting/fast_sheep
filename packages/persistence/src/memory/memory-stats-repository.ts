// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.
import type { StatsRepository } from "../repositories/stats-repository.js";
export class InMemoryStatsRepository implements StatsRepository {
  private map = new Map<string, unknown>();
  set(key: string, value: unknown): void { this.map.set(key, value); }
  get(key: string): unknown | undefined { return this.map.get(key); }
}
