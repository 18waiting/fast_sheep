// Clean-room implementation. Derived only from public/project behavioral specifications
// and frozen contracts. Do not consult original proprietary source/binaries.

export type EventHandler = (event: string, payload?: unknown) => void;
export type Unsubscribe = () => void;

export interface EventBus {
  emit(event: string, payload?: unknown): void;
  on(handler: EventHandler): Unsubscribe;
}