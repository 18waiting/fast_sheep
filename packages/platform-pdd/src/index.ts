// @fastwork/platform-pdd public surface (M7 clean-room).
export { PDD_ERROR_CODES, PddError, pddError, type PddErrorCode } from "./errors.js";
export type {
  PddSessionStatusValue,
  MessageDirection,
  NormalizedInboundMessage,
  RawDomMessage,
  RawDomScan,
  PddCapabilities,
  PageEventType,
  PddPageEvent,
  PddPageEventBase,
  PddSelectedCustomerObservedEvent,
  SelectedCustomerObservationStatus,
  PddPageCommandType,
  PddPageCommand,
  PddPageCommandResult,
  SendResult,
  TransferExecutionResult,
  AutomatedSendAck,
} from "./types.js";
export {
  PDD_CAPABILITIES,
  PDD_CAPABILITY_DESCRIPTORS,
  capabilities,
  supportsCapability,
  CAPABILITY_PROVENANCE,
  type PddCapabilityDescriptor,
  type PddCapabilityMaturity,
} from "./capabilities.js";
export { PDD_SELECTOR_PROFILE, selector, requiredSelectors, type SelectorProfile, type SelectorEntry, type SelectorProvenance } from "./selector-profile.js";
export { normalizeMessage, normalizeScan, fallbackFingerprint, type NormalizeInput } from "./message-normalizer.js";
export { normalizePddInbound, normalizePddInboundForCanonical, type PddInboundPayload, type PddInboundCandidate, type PddInboundNormalizationResult, type PddCanonicalInboundMessage, type PddCanonicalInboundNormalizationResult } from "./inbound-normalizer.js";
export { mapPddInboundToCanonical, type PddCanonicalIdentityBinding, type PddCanonicalScopeBinding, type PddInboundMessageAssociation, type PddCanonicalRuntimeBinding, type MapPddInboundToCanonicalInput, type PddCanonicalMappingResult } from "./inbound-to-canonical.js";
export {
  PDD_SEND_TARGET_KIND,
  validatePddSendIntent,
  validatePddSendState,
  unknownOutcomeDirective,
  type PddSendTarget,
  type PddSendIntentInput,
  type PddSendIntent,
  type PddLocalValidation,
  type PddPlatformAttempt,
  type PddPlatformOutcome,
  type PddPlatformResultFacts,
  type PddSendState,
  type PddSendIntentValidationResult,
  type PddSendIntentRejectionReason,
  type PddSendStateValidationResult,
  type PddSendStateRejectionReason,
  type PddUnknownOutcomeDirective,
} from "./send-text-semantics.js";
export { MessageDeduplicator, type DedupStats } from "./message-deduplicator.js";
export {
  PddSessionState,
  SESSION_STATES,
  LEGAL_SESSION_TRANSITIONS,
  PddSessionTransitionError,
  type SessionStateView,
  type PddSelectedCustomerObservation,
} from "./session-state.js";
export type { PddPageBridge } from "./pdd-page-bridge.js";
export { PddPlatformAdapter, type PddPlatformAdapterOptions } from "./pdd-platform-adapter.js";
export { domHealth, type DomHealthResult } from "./dom/dom-health.js";
export { readConversation, listConversations, type ConversationRead } from "./dom/conversation-reader.js";
export { readMessages } from "./dom/message-reader.js";
export { readComposerState, sendText, sendImage, type ComposerState } from "./dom/composer-driver.js";
export { executeTransfer, FALLBACK_TRANSFER_TEXT } from "./dom/transfer-driver.js";
export { detectHumanReply, type TakeoverSignal } from "./dom/takeover-detector.js";
export { readSelectedCustomer, type SelectedCustomerObservation } from "./dom/selected-customer-reader.js";
export {
  buildPageReady, buildLoginRequired, buildDomUnsupported, buildAuthReauthRequired, buildConversationChanged,
  buildMessageReceived, buildHumanReplyDetected, buildSendAck, buildTransferAck, buildSelectedCustomerObserved, scanToMessages,
} from "./dom/page-events.js";
export type { DomElement, DomDocument, DomLocationProjection } from "./dom/dom-types.js";
export { toDomDocument } from "./dom/dom-types.js";
export { PddPageRuntime, type PageTransport, type PageRuntimeOptions } from "./page/page-runtime.js";
export {
  AUTH_REAUTH_TITLE,
  AUTH_REAUTH_MESSAGE,
  AUTH_REAUTH_ORIGIN,
  AUTH_REAUTH_PATHNAME,
  hasAuthReauthModal,
  hasAuthReauthLocation,
  hasAuthReauthEvidence,
} from "./page/auth-reauth-detector.js";
export { PageMutationObserver, type MutationObserverLike, type ScanCallback } from "./page/mutation-observer.js";
export { handleCommand } from "./page/command-handler.js";
export { MiniEventEmitter, type Listener } from "./page/event-emitter.js";
