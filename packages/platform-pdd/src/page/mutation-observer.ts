// M7 page mutation observer (clean-room, browser-safe). Debounced rescan on DOM
// changes; mutation re-renders must not produce duplicate inbound messages
// (dedup lives in page-runtime).
export interface MutationObserverLike {
  observe(target: unknown, options: unknown): void;
  disconnect(): void;
}

export type ScanCallback = () => void;

export class PageMutationObserver {
  private observer: MutationObserverLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  onScan: (() => void) | null = null;

  constructor(
    private readonly makeObserver: (cb: ScanCallback) => MutationObserverLike,
    private readonly debounceMs = 120,
  ) {}

  start(target: unknown): void {
    if (this.observer) return;
    this.observer = this.makeObserver(() => this.schedule());
    this.observer.observe(target, { childList: true, subtree: true, characterData: true });
  }

  private schedule(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onScan?.();
    }, this.debounceMs);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
