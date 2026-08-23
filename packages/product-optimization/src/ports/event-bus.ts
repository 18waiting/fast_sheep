// M10 event-bus port (clean-room).
export interface EventBus { emit(event: string, payload?: unknown): void }
