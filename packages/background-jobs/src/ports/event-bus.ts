// M10 job event-bus port (clean-room). Clocks live in clock.ts.
import type { Clock } from "./clock.js";
export type { Clock } from "./clock.js";
export { SystemClock, FakeClock } from "./clock.js";
export interface JobEventBus { emit(event: string, payload?: unknown): void }
export class NoopJobEventBus implements JobEventBus { emit(): void {} }
export class RecordingJobEventBus implements JobEventBus {
  events: Array<{ event: string; payload?: unknown }> = [];
  emit(event: string, payload?: unknown): void { this.events.push({ event, payload }); }
}
