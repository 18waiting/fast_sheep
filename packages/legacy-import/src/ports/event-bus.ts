// M11 import event-bus port (clean-room).
export interface ImportEventBus { emit(event: string, payload?: unknown): void }
