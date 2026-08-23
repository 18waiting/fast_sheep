// M9 clock port (clean-room).
export interface Clock {
  now(): number;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

export class FakeClock implements Clock {
  private value: number;
  constructor(start = 0) { this.value = start; }
  now(): number { return this.value; }
  advance(ms: number): void { this.value += ms; }
}
