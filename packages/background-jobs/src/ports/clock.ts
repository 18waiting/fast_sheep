// M10 job clock port (clean-room).
export interface Clock { now(): number }
export class SystemClock implements Clock { now(): number { return Date.now(); } }
export class FakeClock implements Clock {
  private v: number; constructor(start = 0) { this.v = start; } now(): number { return this.v; } advance(ms: number): void { this.v += ms; }
}
