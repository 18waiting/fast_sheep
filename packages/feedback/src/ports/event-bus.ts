// M9 event-bus port (clean-room).
export interface FeedbackEventBus {
  emit(event: string, payload?: unknown): void;
}

export class NoopFeedbackEventBus implements FeedbackEventBus {
  emit(): void {}
}

export class RecordingFeedbackEventBus implements FeedbackEventBus {
  events: Array<{ event: string; payload?: unknown }> = [];
  emit(event: string, payload?: unknown): void { this.events.push({ event, payload }); }
}
