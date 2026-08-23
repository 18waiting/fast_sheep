// M6 worker-status service: safe Renderer-facing lifecycle projection.
import type { WorkerStatusView } from "@fastwork/desktop-ipc";

export type WorkerLifecycleState = "starting" | "ready" | "restarting" | "stopped" | "error";

export interface WorkerStatusSource {
  state(): WorkerLifecycleState;
  version?(): string;
  protocolVersion?(): number;
  lastError?(): string | null;
}

export class WorkerStatusService {
  constructor(private readonly source: WorkerStatusSource) {}

  status(): WorkerStatusView {
    const view: WorkerStatusView = { status: this.source.state() };
    const v = this.source.version?.();
    const p = this.source.protocolVersion?.();
    const e = this.source.lastError?.();
    if (v) view.worker_version = v;
    if (p !== undefined) view.protocol_version = p;
    if (e) view.last_error = e.slice(0, 200);
    return view;
  }
}
