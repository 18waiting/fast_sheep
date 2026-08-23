// Clean-room implementation (TASK-017 M2). Serialized, bounded writes to child stdin.
import { DEFAULT_MAX_QUEUED_FRAMES } from "../protocol/constants.js";

/**
 * Serializes writes to a writable stream (child stdin), respects the stream's
 * backpressure via the "drain" event, and bounds the in-memory queue so memory
 * stays bounded (GF-RPC-011: bounded queue, no unbounded memory).
 */
export class WriteQueue {
  private queue: string[] = [];
  private writing = false;
  private readonly maxQueuedFrames: number;

  constructor(
    private readonly stream: NodeJS.WritableStream,
    opts: { maxQueuedFrames?: number } = {}
  ) {
    this.maxQueuedFrames = opts.maxQueuedFrames ?? DEFAULT_MAX_QUEUED_FRAMES;
  }

  get pending(): number {
    return this.queue.length;
  }

  /** Enqueue a frame. Returns false when the bounded queue is full (caller applies backpressure). */
  push(frame: string): boolean {
    if (this.queue.length >= this.maxQueuedFrames) return false;
    this.queue.push(frame);
    void this.pump();
    return true;
  }

  /** True when there is nothing queued and nothing being written. */
  get idle(): boolean {
    return this.queue.length === 0 && !this.writing;
  }

  private async pump(): Promise<void> {
    if (this.writing) return;
    this.writing = true;
    try {
      while (this.queue.length > 0) {
        const frame = this.queue.shift() as string;
        const ok = this.stream.write(frame, "utf8");
        if (!ok) {
          await new Promise<void>((resolve) => this.stream.once("drain", resolve));
        }
      }
    } finally {
      this.writing = false;
    }
  }
}
