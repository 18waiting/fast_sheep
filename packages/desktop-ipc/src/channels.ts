// Clean-room typed IPC channel constants (M6). No generic channel.
export const IPC = {
  bootstrap: "desktop.bootstrap",
  listShops: "shops.list",
  snapshot: "orchestrator.snapshot",
  conversationsList: "conversations.list",
  conversationsListMessages: "conversations.listMessages",
  workerStatus: "worker.status",
  setMode: "orchestrator.set_mode",
  manualSend: "orchestrator.manual_send",
  noSaveSend: "orchestrator.no_save_send",
  cancel: "orchestrator.cancel",
  focus: "orchestrator.focus",
  orchestratorEvent: "orchestrator.event",
  workerStatusChanged: "worker.status_changed",
  shopsChanged: "shops.changed",
  platformStatus: "platform.status",
  platformActivateShop: "platform.activate_shop",
  platformSetViewBounds: "platform.set_view_bounds",
  platformReload: "platform.reload",
  platformStatusChanged: "platform.status_changed",
  jobsList: "jobs.list",
  jobsGet: "jobs.get",
  jobsCancel: "jobs.cancel",
  learningStart: "learning.start",
  reviewPropose: "review.propose",
  reviewApply: "review.apply",
  reviewRestore: "review.restore",
  auditDecide: "audit.decide",
  optimizationPropose: "optimization.propose",
  optimizationApply: "optimization.apply",
  jobsChanged: "jobs.changed",
  learningChanged: "learning.changed",
  reviewChanged: "review.changed",
  auditChanged: "audit.changed",
  optimizationChanged: "optimization.changed",
  legacyImportSelect: "legacy_import.select",
  legacyImportScan: "legacy_import.scan",
  legacyImportPlan: "legacy_import.plan",
  legacyImportDryRun: "legacy_import.dry_run",
  legacyImportApply: "legacy_import.apply",
  legacyImportStatus: "legacy_import.status",
  legacyImportCancel: "legacy_import.cancel",
  legacyImportChanged: "legacy_import.changed",
  storeKnowledgeUpsert: "store_knowledge.upsert",
  storeKnowledgeQuery: "store_knowledge.query",
  storeKnowledgeList: "store_knowledge.list",
  storeKnowledgeDelete: "store_knowledge.delete",
  storeKnowledgeChanged: "store_knowledge.changed",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

export const QUERY_CHANNELS: readonly string[] = [IPC.bootstrap, IPC.listShops, IPC.snapshot, IPC.workerStatus, IPC.conversationsList, IPC.conversationsListMessages, IPC.platformStatus, IPC.jobsList, IPC.jobsGet, IPC.legacyImportStatus, IPC.storeKnowledgeQuery, IPC.storeKnowledgeList];
export const COMMAND_CHANNELS: readonly string[] = [IPC.setMode, IPC.manualSend, IPC.noSaveSend, IPC.cancel, IPC.focus, IPC.platformActivateShop, IPC.platformSetViewBounds, IPC.platformReload, IPC.jobsCancel, IPC.learningStart, IPC.reviewPropose, IPC.reviewApply, IPC.reviewRestore, IPC.auditDecide, IPC.optimizationPropose, IPC.optimizationApply, IPC.legacyImportSelect, IPC.legacyImportScan, IPC.legacyImportPlan, IPC.legacyImportDryRun, IPC.legacyImportApply, IPC.legacyImportCancel, IPC.storeKnowledgeUpsert, IPC.storeKnowledgeDelete];
export const EVENT_CHANNELS: readonly string[] = [IPC.orchestratorEvent, IPC.workerStatusChanged, IPC.shopsChanged, IPC.platformStatusChanged, IPC.jobsChanged, IPC.learningChanged, IPC.reviewChanged, IPC.auditChanged, IPC.optimizationChanged, IPC.legacyImportChanged, IPC.storeKnowledgeChanged];
export const ALL_CHANNELS: readonly string[] = [...QUERY_CHANNELS, ...COMMAND_CHANNELS, ...EVENT_CHANNELS];

export function isAllowedChannel(channel: string): boolean {
  return (ALL_CHANNELS as readonly string[]).includes(channel);
}

