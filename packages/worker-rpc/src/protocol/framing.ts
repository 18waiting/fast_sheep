// Clean-room implementation (TASK-017 M2). UTF-8 JSONL framing.
import { RpcError, RPC_ERROR_CODES } from "./errors.js";
import { DEFAULT_MAX_FRAME_BYTES } from "./constants.js";
import type { DecodeOutcome } from "./types.js";

export interface DecoderOptions {
  maxFrameBytes?: number;
  /** Called for every decoded outcome (frame / malformed / oversize). */
  onOutcome?: (outcome: DecodeOutcome) => void;
}

/**
 * Incremental JSONL decoder: accepts arbitrary chunk sizes, accumulates partial lines,
 * emits complete frames (multiple frames per chunk supported), enforces a maximum frame
 * size, and reports malformed JSON deterministically without crashing the process.
 */
export class JsonlDecoder {
  private buffer = "";
  private readonly maxFrameBytes: number;
  private readonly onOutcome?: (outcome: DecodeOutcome) => void;

  constructor(opts: DecoderOptions = {}) {
    this.maxFrameBytes = opts.maxFrameBytes ?? DEFAULT_MAX_FRAME_BYTES;
    this.onOutcome = opts.onOutcome;
  }

  push(chunk: string | Buffer): void {
    this.buffer += chunk.toString("utf8");
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      this.processLine(line);
    }
    // No newline yet: if the buffered partial line already exceeds the limit, reject it
    // and reset so memory stays bounded.
    if (this.buffer.length > this.maxFrameBytes) {
      const frameBytes = this.buffer.length;
      this.emit({ kind: "oversize", frameBytes, maxFrameBytes: this.maxFrameBytes });
      this.buffer = "";
    }
  }

  private processLine(line: string): void {
    const frameBytes = Buffer.byteLength(line, "utf8");
    if (frameBytes > this.maxFrameBytes) {
      this.emit({ kind: "oversize", frameBytes, maxFrameBytes: this.maxFrameBytes });
      return;
    }
    if (line.trim() === "") return; // blank lines are ignored
    let frame: unknown;
    try {
      frame = JSON.parse(line);
    } catch {
      this.emit({ kind: "malformed", line, frameBytes });
      return;
    }
    this.emit({ kind: "frame", frame });
  }

  private emit(outcome: DecodeOutcome): void {
    this.onOutcome?.(outcome);
  }
}

/** Encode a single protocol frame: one UTF-8 JSON object + "\n". Enforces max size. */
export function encodeFrame(obj: unknown, maxFrameBytes: number = DEFAULT_MAX_FRAME_BYTES): string {
  const line = JSON.stringify(obj);
  if (Buffer.byteLength(line, "utf8") > maxFrameBytes) {
    throw new RpcError(RPC_ERROR_CODES.FRAME_TOO_LARGE, `frame exceeds maximum size (${Buffer.byteLength(line, "utf8")} > ${maxFrameBytes})`);
  }
  return line + "\n";
}
