# Clean-Room Contract Schema Catalog

> TASK-015B deliverable. Generated from `schemas/registry.json` (183 schemas) on 2026-08-16.

## 1. Purpose
Authoritative catalog of clean-room implementation JSON Schemas under `rebuild/packages/contracts/schemas/`. JSON Schema (Draft 2020-12) is the single source of truth for cross-process contracts; TS/Python types mirror but do not replace it.

## 2. Canonical Contract Policy
- Schema draft: **2020-12**. Envelopes (rpc/response, rpc/event, error) use `additionalProperties: false`; extension-bearing fields (`details`, `metadata`, `payload`) explicitly allow structured extras.
- Secrets are never contract values: `ProviderConfig.credential_ref` (ADR-004).

## 3. Versioning Policy
- `CONTRACT_SCHEMA_VERSION=2020-12`, `WORKER_RPC_VERSION=1`, `PARITY_FIXTURE_VERSION=2026-08-15.1` (packages/contracts/src/versions.ts).
- Registry `registry_version=1.0`; per-schema `version` from `contract-registry.json` (default 1.0).

## 4. RPC Schemas

| Schema | Version | $id | Category | Purpose | Owner | Producer | Consumer | Behavior IDs | Status |
|---|---|---|---|---|---|---|---|---|---|
| cancel-payload.schema.json | 1.0 | `fastwork:rpc:cancel-payload` | rpc | CancelPayload | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker |  | REGISTERED |
| cancel-result.schema.json | 1.0 | `fastwork:rpc:cancel-result` | rpc | CancelResult | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker |  | REGISTERED |
| context.schema.json | 1.0 | `fastwork:rpc:context` | rpc | RpcContext | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker |  | REGISTERED |
| error.schema.json | 1.0 | `fastwork:rpc:error` | rpc | RpcError | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker |  | REGISTERED |
| event.schema.json | 1.0 | `fastwork:rpc:event` | rpc | RpcEvent | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker | B-IPC-001 | REGISTERED |
| health-result.schema.json | 1.0 | `fastwork:rpc:health-result` | rpc | HealthResult | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker |  | REGISTERED |
| protocol-error-payload.schema.json | 1.0 | `fastwork:rpc:protocol-error-payload` | rpc | ProtocolErrorPayload | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker |  | REGISTERED |
| request.schema.json | 1.0 | `fastwork:rpc:request` | rpc | RpcRequest | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker | B-CONV-001, B-IPC-001 | REGISTERED |
| response.schema.json | 1.0 | `fastwork:rpc:response` | rpc | RpcResponse | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker | B-IPC-001 | REGISTERED |
| shutdown-result.schema.json | 1.0 | `fastwork:rpc:shutdown-result` | rpc | ShutdownResult | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker |  | REGISTERED |
| worker-ready-payload.schema.json | 1.0 | `fastwork:rpc:worker-ready-payload` | rpc | WorkerReadyPayload | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker |  | REGISTERED |

## 5. Error Schemas

| Schema | Version | $id | Category | Purpose | Owner | Producer | Consumer | Behavior IDs | Status |
|---|---|---|---|---|---|---|---|---|---|
| error.schema.json | 1.0 | `fastwork:error` | error | Error | AIWorkerClient, AIWorker | - | AIWorkerClient, AIWorker | B-TOOL-005, B-IPC-001, B-SEC-002, B-PROV-005 | REGISTERED |

## 6. Domain Schemas

| Schema | Version | $id | Category | Purpose | Owner | Producer | Consumer | Behavior IDs | Status |
|---|---|---|---|---|---|---|---|---|---|
| background-job.schema.json | 1.0 | `fastwork:domain:background-job` | domain | BackgroundJob | BackgroundJobManager | BackgroundJobManager | BackgroundJobManager | B-JOB-001 | REGISTERED |
| conversation.schema.json | 1.0 | `fastwork:domain:conversation` | domain | Conversation | ConversationRepository | ConversationOrchestrator | ConversationRepository | B-STORE-006 | REGISTERED |
| conversation-context.schema.json | 1.0 | `fastwork:domain:conversation-context` | domain | ConversationContext | ConversationContextBuilder, ConversationEngine | - | ConversationContextBuilder, ConversationEngine | B-CONV-001, B-CONV-004, B-PROMPT-004 | REGISTERED |
| conversation-message.schema.json | 1.0 | `fastwork:domain:conversation-message` | domain | ConversationMessage | ConversationRepository, ConversationOrchestrator | - | ConversationRepository, ConversationOrchestrator | B-STORE-006, B-PLATFORM-001, B-PLATFORM-002 | REGISTERED |
| feedback-record.schema.json | 1.0 | `fastwork:domain:feedback-record` | domain | FeedbackRecord | FeedbackService, FeedbackRepository | - | FeedbackService, FeedbackRepository | B-FEEDBACK-001, B-FEEDBACK-002 | REGISTERED |
| generation-request.schema.json | 1.0 | `fastwork:domain:generation-request` | domain | GenerationRequest | GenerationProviderRouter, ConversationEngine | - | GenerationProviderRouter, ConversationEngine | B-PROV-002, B-PROV-003, B-PROV-004 | REGISTERED |
| generation-result.schema.json | 1.0 | `fastwork:domain:generation-result` | domain | GenerationResult | GenerationProviderRouter, ConversationEngine | - | GenerationProviderRouter, ConversationEngine | B-TOOL-003, B-TOOL-005, B-PROV-001, B-PROV-005 | REGISTERED |
| knowledge-candidate.schema.json | 1.0 | `fastwork:domain:knowledge-candidate` | domain | KnowledgeCandidate | KnowledgeRepository, AuditEngine | - | KnowledgeRepository, AuditEngine | B-STORE-001, B-JOB-003, B-JOB-004 | REGISTERED |
| knowledge-entry.schema.json | 1.0 | `fastwork:domain:knowledge-entry` | domain | KnowledgeEntry | KnowledgeRepository | KnowledgeCommitter | KnowledgeRepository | B-STORE-001, B-FEEDBACK-001, B-FEEDBACK-002 | REGISTERED |
| prompt-profile.schema.json | 1.0 | `fastwork:domain:prompt-profile` | domain | PromptProfile | PromptRepository, PromptEngine | - | PromptRepository, PromptEngine | B-PROMPT-001, B-PROMPT-002, B-PROMPT-003, B-STORE-004 | REGISTERED |
| retrieval-result.schema.json | 1.0 | `fastwork:domain:retrieval-result` | domain | RetrievalResult | RAGEngine | RAGEngine | RAGEngine | B-RAG-001, B-RAG-002, B-RAG-003, B-RAG-004, B-RAG-005, B-RAG-006 | REGISTERED |
| send-command.schema.json | 1.0 | `fastwork:domain:send-command` | domain | SendCommand | ConversationOrchestrator, PlatformSenderAdapter | ConversationOrchestrator | ConversationOrchestrator, PlatformSenderAdapter | B-CONV-008, B-PLATFORM-003 | REGISTERED |
| send-result.schema.json | 1.0 | `fastwork:domain:send-result` | domain | SendResult | PlatformSenderAdapter | - | PlatformSenderAdapter | B-CONV-008, B-PLATFORM-003 | REGISTERED |
| send-segment.schema.json | 1.0 | `fastwork:domain:send-segment` | domain | SendSegment | ConversationOrchestrator, PlatformSenderAdapter | - | ConversationOrchestrator, PlatformSenderAdapter | B-CONV-008 | REGISTERED |
| shop.schema.json | 1.0 | `fastwork:domain:shop` | domain | Shop | ShopRepository | Node settings/shop-store | ShopRepository | B-STORE-002 | REGISTERED |
| shop-session.schema.json | 1.0 | `fastwork:domain:shop-session` | domain | ShopSession | ShopSessionManager | ShopSessionManager | ShopSessionManager | B-PLATFORM-001 | REGISTERED |
| skill-definition.schema.json | 1.0 | `fastwork:domain:skill-definition` | domain | SkillDefinition | SkillRepository, ToolRegistry | - | SkillRepository, ToolRegistry | B-PROMPT-002, B-TOOL-001, B-SEC-001 | REGISTERED |
| suggestion.schema.json | 1.0 | `fastwork:domain:suggestion` | domain | Suggestion | ConversationEngine, ConversationOrchestrator | ConversationEngine | ConversationEngine, ConversationOrchestrator | B-CONV-005, B-CONV-006, B-CONV-007 | REGISTERED |
| tool-call.schema.json | 1.0 | `fastwork:domain:tool-call` | domain | ToolCall | ToolExecutor, AgentLoop | - | ToolExecutor, AgentLoop | B-TOOL-001, B-TOOL-002, B-TOOL-003 | REGISTERED |
| tool-result.schema.json | 1.0 | `fastwork:domain:tool-result` | domain | ToolResult | ToolExecutor, AgentLoop | - | ToolExecutor, AgentLoop | B-TOOL-002, B-TOOL-004, B-SEC-001 | REGISTERED |
| transfer-decision.schema.json | 1.0 | `fastwork:domain:transfer-decision` | domain | TransferDecision | HandoffEngine | - | HandoffEngine | B-HANDOFF-001, B-HANDOFF-002, B-HANDOFF-003, B-HANDOFF-004 | REGISTERED |

## 7. Configuration Schemas

| Schema | Version | $id | Category | Purpose | Owner | Producer | Consumer | Behavior IDs | Status |
|---|---|---|---|---|---|---|---|---|---|
| ai-config.schema.json | 1.0 | `fastwork:config:ai-config` | configuration | AIConfig | SettingsRepository | - | SettingsRepository | B-PROMPT-001, B-STORE-003 | REGISTERED |
| collaboration-config.schema.json | 1.0 | `fastwork:config:collaboration-config` | configuration | CollaborationConfig | SettingsRepository | - | SettingsRepository | B-CONV-006, B-CONV-007, B-STORE-003 | REGISTERED |
| conversation-policy-config.schema.json | 1.0 | `fastwork:config:conversation-policy-config` | configuration | ConversationPolicyConfig | SettingsRepository | - | SettingsRepository | B-CONV-004, B-STORE-005 | REGISTERED |
| feature-flags.schema.json | 1.0 | `fastwork:config:feature-flags` | configuration | FeatureFlags | SettingsRepository | - | SettingsRepository |  | REGISTERED |
| handoff-config.schema.json | 1.0 | `fastwork:config:handoff-config` | configuration | HandoffConfig | SettingsRepository | - | SettingsRepository | B-HANDOFF-001, B-HANDOFF-002, B-HANDOFF-003 | REGISTERED |
| learning-config.schema.json | 1.0 | `fastwork:config:learning-config` | configuration | LearningConfig | SettingsRepository | - | SettingsRepository | B-JOB-002 | REGISTERED |
| optimization-config.schema.json | 1.0 | `fastwork:config:optimization-config` | configuration | OptimizationConfig | SettingsRepository | - | SettingsRepository | B-JOB-005 | REGISTERED |
| platform-config.schema.json | 1.0 | `fastwork:config:platform-config` | configuration | PlatformConfig | SettingsRepository | - | SettingsRepository | B-PLATFORM-002 | REGISTERED |
| provider-config.schema.json | 1.0 | `fastwork:config:provider-config` | configuration | ProviderConfig | SettingsRepository | - | SettingsRepository | B-SEC-002, B-PROV-001, B-PROV-002, B-PROV-003, B-PROV-004, B-PROV-005 | REGISTERED |
| rag-config.schema.json | 1.0 | `fastwork:config:rag-config` | configuration | RAGConfig | SettingsRepository | - | SettingsRepository | B-RAG-001, B-RAG-002, B-RAG-003, B-RAG-004, B-RAG-005, B-PROMPT-003, B-RAG-006 | REGISTERED |
| storage-config.schema.json | 1.0 | `fastwork:config:storage-config` | configuration | StorageConfig | SettingsRepository | - | SettingsRepository |  | REGISTERED |

## 8. Event Schemas

| Schema | Version | $id | Category | Purpose | Owner | Producer | Consumer | Behavior IDs | Status |
|---|---|---|---|---|---|---|---|---|---|
| buyer-message-received.schema.json | 1.0 | `fastwork:event:buyer-message-received` | event | Event buyer-message-received | EventBus | - | EventBus |  | REGISTERED |
| conversation-state-changed.schema.json | 1.0 | `fastwork:event:conversation-state-changed` | event | Event conversation-state-changed | EventBus | - | EventBus | B-CONV-005 | REGISTERED |
| event-envelope.schema.json | 1.0 | `fastwork:event:envelope` | event | EventEnvelope | EventBus | - | EventBus |  | REGISTERED |
| human-takeover.schema.json | 1.0 | `fastwork:event:human-takeover` | event | Event human-takeover | EventBus | - | EventBus |  | REGISTERED |
| index-rebuild-completed.schema.json | 1.0 | `fastwork:event:index-rebuild-completed` | event | Event index-rebuild-completed | EventBus | - | EventBus | B-JOB-006 | REGISTERED |
| index-rebuild-started.schema.json | 1.0 | `fastwork:event:index-rebuild-started` | event | Event index-rebuild-started | EventBus | - | EventBus | B-JOB-006 | REGISTERED |
| job-state-changed.schema.json | 1.0 | `fastwork:event:job-state-changed` | event | Event job-state-changed | EventBus | - | EventBus |  | REGISTERED |
| knowledge-updated.schema.json | 1.0 | `fastwork:event:knowledge-updated` | event | Event knowledge-updated | EventBus | - | EventBus | B-JOB-003, B-JOB-004 | REGISTERED |
| learning-progress.schema.json | 1.0 | `fastwork:event:learning-progress` | event | Event learning-progress | EventBus | - | EventBus | B-JOB-001 | REGISTERED |
| optimization-progress.schema.json | 1.0 | `fastwork:event:optimization-progress` | event | Event optimization-progress | EventBus | - | EventBus |  | REGISTERED |
| send-completed.schema.json | 1.0 | `fastwork:event:send-completed` | event | Event send-completed | EventBus | - | EventBus |  | REGISTERED |
| send-started.schema.json | 1.0 | `fastwork:event:send-started` | event | Event send-started | EventBus | - | EventBus |  | REGISTERED |
| suggestion-ready.schema.json | 1.0 | `fastwork:event:suggestion-ready` | event | Event suggestion-ready | EventBus | - | EventBus |  | REGISTERED |
| transfer-requested.schema.json | 1.0 | `fastwork:event:transfer-requested` | event | Event transfer-requested | EventBus | - | EventBus |  | REGISTERED |

## 9. Shared Enums

| Schema | Version | $id | Category | Purpose | Owner | Producer | Consumer | Behavior IDs | Status |
|---|---|---|---|---|---|---|---|---|---|
| conversation-role.schema.json | 1.0 | `fastwork:common:conversation-role` | common | ConversationRole | contracts | - | contracts |  | REGISTERED |
| job-state.schema.json | 1.0 | `fastwork:common:job-state` | common | JobState | contracts | - | contracts |  | REGISTERED |
| parity-level.schema.json | 1.0 | `fastwork:common:parity-level` | common | ParityLevel | contracts | - | contracts |  | REGISTERED |
| platform.schema.json | 1.0 | `fastwork:common:platform` | common | Platform | contracts | - | contracts |  | REGISTERED |
| send-state.schema.json | 1.0 | `fastwork:common:send-state` | common | SendState | contracts | - | contracts |  | REGISTERED |
| test-class.schema.json | 1.0 | `fastwork:common:test-class` | common | TestClass | contracts | - | contracts |  | REGISTERED |
| trust-level.schema.json | 1.0 | `fastwork:common:trust-level` | common | TrustLevel | contracts | - | contracts |  | REGISTERED |

## 10. Cross-Language Validation
- TS: `packages/contracts/src/validate.ts` (Ajv 2020) — compile + example/negative tests (`tests/contracts/contract-schemas.test.mjs`, 12/12 PASS).
- Python: `services/ai-worker/src/fastwork_ai_worker/contracts/validator.py` — generic validator; corpus `packages/contracts/testdata/cross-language-cases.json`; report `rebuild/reports/cross-language-contract-report.json`.

## 11. Behavior Traceability
`behavior-contract-map.json` maps behavior IDs → schema IDs → milestone. Reverse mapping (schema → behavior IDs) is embedded in each registry entry (`parity_behavior_ids`).

## 12. Invalid / Incomplete Metadata
- None — every schema carries a unique `$id`, `$title`, and `$schema`.

## 13. Current Coverage
- Registered schemas: 183
- Categories: other, common, configuration, domain, error, event, rpc
- P0 behaviors referenced by schemas: 50 distinct behavior IDs