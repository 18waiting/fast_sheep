// Tiny browser-safe event emitter (no Node deps).
export type Listener<T> = (payload: T) => void;

export class MiniEventEmitter<T> {
  private listeners: Array<Listener<T>> = [];
  on(listener: Listener<T>): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
  emit(payload: T): void {
    for (const l of [...this.listeners]) l(payload);
  }
}
