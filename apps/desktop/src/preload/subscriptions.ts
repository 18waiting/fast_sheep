// M6 preload subscription factory (pure, injectable, no Electron imports).
// Used by the Node-side unit tests; index.ts exposes the same surface inline.
import { IPC } from "@fastwork/desktop-ipc";
import type { OrchestratorEventPayload, PlatformStatusChangedEvent, WorkerStatusView, BackgroundJobEvent, LearningChangedEvent, ReviewChangedEvent, AuditChangedEvent, OptimizationChangedEvent, LegacyImportEvent } from "@fastwork/desktop-ipc";

/** Minimal ipcRenderer.on-compatible adapter returning an unsubscribe. */
export type SubscribeFn = (channel: string, listener: (event: unknown, payload: unknown) => void) => () => void;

export interface DesktopApiSubscriptionSurface {
  onOrchestratorEvent(handler: (ev: OrchestratorEventPayload) => void): () => void;
  onWorkerStatusChanged(handler: (status: WorkerStatusView) => void): () => void;
  onShopsChanged(handler: () => void): () => void;
  onPlatformStatusChanged(handler: (ev: PlatformStatusChangedEvent) => void): () => void;
  onJobsChanged(handler: (ev: BackgroundJobEvent) => void): () => void;
  onLearningChanged(handler: (ev: LearningChangedEvent) => void): () => void;
  onReviewChanged(handler: (ev: ReviewChangedEvent) => void): () => void;
  onAuditChanged(handler: (ev: AuditChangedEvent) => void): () => void;
  onOptimizationChanged(handler: (ev: OptimizationChangedEvent) => void): () => void;
  onLegacyImportChanged(handler: (ev: LegacyImportEvent) => void): () => void;
}

export function createSubscriptions(subscribe: SubscribeFn): DesktopApiSubscriptionSurface {
  return {
    onOrchestratorEvent: (handler) =>
      subscribe(IPC.orchestratorEvent, (_event, payload) => handler(payload as OrchestratorEventPayload)),
    onWorkerStatusChanged: (handler) =>
      subscribe(IPC.workerStatusChanged, (_event, payload) => handler(payload as WorkerStatusView)),
    onShopsChanged: (handler) =>
      subscribe(IPC.shopsChanged, () => handler()),
    onPlatformStatusChanged: (handler) =>
      subscribe(IPC.platformStatusChanged, (_event, payload) => handler(payload as PlatformStatusChangedEvent)),
    onJobsChanged: (handler) =>
      subscribe(IPC.jobsChanged, (_event, payload) => handler(payload as BackgroundJobEvent)),
    onLearningChanged: (handler) =>
      subscribe(IPC.learningChanged, (_event, payload) => handler(payload as LearningChangedEvent)),
    onReviewChanged: (handler) =>
      subscribe(IPC.reviewChanged, (_event, payload) => handler(payload as ReviewChangedEvent)),
    onAuditChanged: (handler) =>
      subscribe(IPC.auditChanged, (_event, payload) => handler(payload as AuditChangedEvent)),
    onOptimizationChanged: (handler) =>
      subscribe(IPC.optimizationChanged, (_event, payload) => handler(payload as OptimizationChangedEvent)),
    onLegacyImportChanged: (handler) =>
      subscribe(IPC.legacyImportChanged, (_event, payload) => handler(payload as LegacyImportEvent)),
  };
}
