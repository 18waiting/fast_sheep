// M5 test fake: deterministic clock (virtual time).
export class VirtualClock {
  private t = 0;
  now(): number { return this.t; }
  advance(ms: number): void { this.t += ms; }
  set(ms: number): void { this.t = ms; }
}
