// M6 workbench projection: Renderer-safe WorkbenchViewModel only; no business decisions.
import type { WorkbenchViewModel, WorkerStatusView, ShopSummary } from "@fastwork/desktop-ipc";

export interface ProjectionSource {
  revision(): number;
  shops(): ShopSummary[];
  selectedShopId(): string | null;
  conversation(): { conversation_id: string; shop_id: string; state: string; buyer?: string } | null;
  suggestion(): { reply: string; generation: number; status: string; mode?: string } | null;
  mode(): "human_review" | "full_auto";
  countdown(): { enabled: boolean; remaining_ticks: number; tick_ms: number } | null;
  sendStatus(): string | null;
  takeoverStatus(): string | null;
  workerStatus(): WorkerStatusView;
  lastError(): string | null;
  /** M7: platform capability for the selected shop ("none" | "pdd"). */
  platformCapability?(): string;
}

export class WorkbenchProjectionService {
  constructor(private readonly source: ProjectionSource) {}

  selectedShopId(): string | null {
    return this.source.selectedShopId();
  }

  project(): WorkbenchViewModel {
    const vm: WorkbenchViewModel = {
      revision: this.source.revision(),
      shop_summaries: this.source.shops(),
      worker_status: this.source.workerStatus(),
      platform_capability: (this.source.platformCapability?.() ?? "none") as "none" | "pdd",
    };
    const sid = this.source.selectedShopId();
    if (sid) vm.selected_shop_id = sid;
    const conv = this.source.conversation();
    if (conv) vm.conversation = conv;
    const sug = this.source.suggestion();
    if (sug) vm.suggestion = sug;
    vm.mode = this.source.mode();
    const cd = this.source.countdown();
    if (cd) vm.countdown = cd;
    const ss = this.source.sendStatus();
    if (ss) vm.send_status = ss;
    const ts = this.source.takeoverStatus();
    if (ts) vm.takeover_status = ts;
    const err = this.source.lastError();
    if (err) vm.last_error = err.slice(0, 200);
    return vm;
  }
}
