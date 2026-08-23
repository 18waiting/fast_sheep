// Clean-room implementation (TASK-017 M2). Worker subprocess management (no business RPC).
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { JsonlDecoder, encodeFrame } from "../protocol/framing.js";
import { DEFAULT_MAX_FRAME_BYTES, WORKER_ENV_ALLOWLIST } from "../protocol/constants.js";
import type { WorkerSpawn } from "../protocol/types.js";

export interface WorkerProcessOptions {
  maxFrameBytes?: number;
  /** Extra env to pass (whitelisted). Never dumps the full parent environment. */
  env?: Record<string, string>;
  /** Callback for protocol frames decoded from stdout. */
  onFrame: (frame: unknown) => void;
  /** Callback for malformed/oversize decode outcomes. */
  onProtocolIssue?: (issue: { kind: "malformed" | "oversize"; frameBytes: number; maxFrameBytes: number; line?: string }) => void;
  /** Callback for stderr diagnostics (line-based). */
  onStderr?: (line: string) => void;
  /** Called when the child exits. */
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
}

/**
 * Spawns the worker with an injected executable/args/cwd/env, parses stdout as JSONL,
 * captures stderr as diagnostics, and exposes write/kill. No listening socket is created.
 */
export class WorkerProcess {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly decoder: JsonlDecoder;
  private readonly maxFrameBytes: number;
  private readonly spawnConfig: WorkerSpawn;
  private readonly options: WorkerProcessOptions;
  private stderrBuffer = "";

  constructor(spawnConfig: WorkerSpawn, options: WorkerProcessOptions) {
    this.spawnConfig = spawnConfig;
    this.options = options;
    this.maxFrameBytes = options.maxFrameBytes ?? DEFAULT_MAX_FRAME_BYTES;
    this.decoder = new JsonlDecoder({
      maxFrameBytes: this.maxFrameBytes,
      onOutcome: (outcome) => {
        if (outcome.kind === "frame") {
          this.options.onFrame(outcome.frame);
        } else if (outcome.kind === "malformed") {
          this.options.onProtocolIssue?.({ kind: "malformed", frameBytes: outcome.frameBytes, maxFrameBytes: this.maxFrameBytes, line: outcome.line });
        } else {
          this.options.onProtocolIssue?.({ kind: "oversize", frameBytes: outcome.frameBytes, maxFrameBytes: this.maxFrameBytes });
        }
      },
    });
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  get stdin(): NodeJS.WritableStream | null {
    return this.child?.stdin ?? null;
  }

  start(): void {
    const env = this.buildEnv();
    this.child = spawn(this.spawnConfig.executable, this.spawnConfig.args, {
      cwd: this.spawnConfig.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.decoder.push(chunk));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.stderrBuffer += chunk;
      const lines = this.stderrBuffer.split(/\r?\n/);
      this.stderrBuffer = lines.pop() ?? "";
      for (const line of lines) this.options.onStderr?.(line);
    });
    this.child.on("error", (err) => {
      // Emitted when spawn fails (e.g. executable missing); surface as an exit-like event.
      this.options.onStderr?.(`spawn error: ${err.message}`);
      this.options.onExit(null, null);
      this.child = null;
    });
    this.child.on("exit", (code, signal) => {
      this.options.onExit(code, signal);
      this.child = null;
    });
  }

  writeFrame(frame: unknown): string {
    return encodeFrame(frame, this.maxFrameBytes);
  }

  /** Best-effort graceful shutdown: close stdin, then kill after a deadline. */
  stop(graceMs: number): Promise<void> {
    return new Promise((resolve) => {
      const child = this.child;
      if (!child) return resolve();
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, graceMs);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      try {
        child.stdin.end();
      } catch {
        child.kill();
      }
    });
  }

  kill(): void {
    this.child?.kill();
  }

  /** Force terminate on Windows (taskkill) then fall back to kill. */
  forceKill(): void {
    const child = this.child;
    if (!child) return;
    try {
      child.kill("SIGKILL");
    } catch {
      child.kill();
    }
  }

  private buildEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      PYTHONIOENCODING: "utf-8",
      PYTHONUNBUFFERED: "1",
    };
    const source = this.spawnConfig.env ?? this.options.env ?? {};
    for (const key of WORKER_ENV_ALLOWLIST) {
      if (source[key] !== undefined) env[key] = source[key];
    }
    return env;
  }
}
