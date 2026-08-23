// M10 renderer panel view-model + actions (clean-room).
// Projection/control only: the renderer never mutates knowledge/products,
// never calls providers, never touches SQLite, and never uses raw IPC.
export interface M10JobView {
  job_id: string;
  type: string;
  state: string;
  progress: number;
  message: string;
}

export interface M10PanelViewModel {
  jobs: M10JobView[];
  lastLearningEvent?: string | null;
  lastReviewEvent?: string | null;
  lastAuditEvent?: string | null;
  lastOptimizationEvent?: string | null;
}

export interface M10PanelActions {
  onRefreshJobs(): void;
  onStartLearning(importSource?: string): void;
  onReviewPropose(): void;
  onReviewApply(): void;
  onReviewRestore(): void;
  onAudit(action: "保留" | "丢弃" | "待定"): void;
  onOptimizationPropose(productId: string): void;
  onOptimizationApply(productId: string, detail: string): void;
  onCancelJob(jobId: string): void;
}

export const EMPTY_M10_VIEW_MODEL: M10PanelViewModel = {
  jobs: [],
  lastLearningEvent: null,
  lastReviewEvent: null,
  lastAuditEvent: null,
  lastOptimizationEvent: null,
};

export const JOB_STATE_LABELS: Record<string, string> = {
  QUEUED: "排队中",
  RUNNING: "运行中",
  CANCELLING: "取消中",
  COMPLETED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};
