// Clean-room implementation (TASK-017 M2). Pending request registry: request_id -> promise state.
import { RpcError, RPC_ERROR_CODES } from "../protocol/errors.js";

export interface PendingEntry<T = unknown> {
  method: string;
  resolve: (value: T) => void;
  reject: (reason: RpcError) => void;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  onAbort?: () => void;
  settled: boolean;
}

export interface RegisterOptions {
  timeoutMs: number;
  onTimeout?: (requestId: string) => void;
  signal?: AbortSignal;
  onAbort?: (requestId: string) => void;
}

/**
 * Holds pending request state. Guarantees:
 * - duplicate active request IDs are rejected (no state overwrite);
 * - every terminal path removes the entry (leak-free);
 * - a late response for a settled request is a no-op.
 */
export class PendingRequestRegistry {
  private readonly pending = new Map<string, PendingEntry>();

  get size(): number {
    return this.pending.size;
  }

  has(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  register<T>(
    requestId: string,
    method: string,
    opts: RegisterOptions
  ): { ok: true; promise: Promise<T> } | { ok: false; reason: string } {
    if (this.pending.has(requestId)) {
      return { ok: false, reason: `duplicate active request id: ${requestId}` };
    }

    let resolve!: (v: T) => void;
    let reject!: (r: RpcError) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const entry: PendingEntry<T> = {
      method,
      resolve,
      reject,
      timer: setTimeout(() => {
        this.remove(requestId);
        opts.onTimeout?.(requestId);
        reject(new RpcError(RPC_ERROR_CODES.TIMEOUT));
      }, opts.timeoutMs),
      signal: opts.signal,
      settled: false,
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(entry.timer);
        this.remove(requestId);
        reject(new RpcError(RPC_ERROR_CODES.CANCELLED));
        return { ok: false, reason: "signal already aborted" };
      }
      entry.onAbort = () => {
        this.remove(requestId);
        opts.onAbort?.(requestId);
        reject(new RpcError(RPC_ERROR_CODES.CANCELLED));
      };
      opts.signal.addEventListener("abort", entry.onAbort, { once: true });
    }

    this.pending.set(requestId, entry as PendingEntry);
    return { ok: true, promise };
  }

  /** Settle the pending entry (response received). Late calls for settled entries are no-ops. */
  settle(requestId: string, fn: (entry: PendingEntry) => void): boolean {
    const entry = this.pending.get(requestId);
    if (!entry || entry.settled) return false;
    entry.settled = true;
    clearTimeout(entry.timer);
    entry.signal?.removeEventListener("abort", entry.onAbort as EventListener);
    this.pending.delete(requestId);
    fn(entry);
    return true;
  }

  remove(requestId: string): void {
    const entry = this.pending.get(requestId);
    if (!entry) return;
    entry.settled = true;
    clearTimeout(entry.timer);
    entry.signal?.removeEventListener("abort", entry.onAbort as EventListener);
    this.pending.delete(requestId);
  }

  /** Fail every pending request deterministically (worker crash / shutdown). */
  failAll(error: RpcError): number {
    let n = 0;
    for (const [requestId, entry] of [...this.pending.entries()]) {
      this.remove(requestId);
      entry.reject(error);
      n += 1;
    }
    return n;
  }

  /** Fail all pending requests except the given id (used on shutdown after system.shutdown sent). */
  failAllExcept(requestId: string | null, error: RpcError): number {
    let n = 0;
    for (const [rid, entry] of [...this.pending.entries()]) {
      if (rid === requestId) continue;
      this.remove(rid);
      entry.reject(error);
      n += 1;
    }
    return n;
  }
}
