// @fastwork/platform-web-common public surface (M8 clean-room).
export type {
  PlatformSessionStatusValue, MessageDirection, NormalizedInboundMessage, RawDomMessage, RawDomScan,
  PlatformCapabilities, PlatformPageEventType, PlatformPageEvent, PlatformPageCommand,
  PlatformPageCommandResult, SendResult, TransferExecutionResult, AutomatedSendAck,
  DomElement, DomDocument, ConversationRead, ComposerState,
} from "./types.js";
export { PLATFORM_ERROR_CODES, PlatformError, platformError, type PlatformErrorCode } from "./errors.js";
export { isCapabilitySupported, unsupportedError, type CapabilityClaim } from "./capabilities.js";
export { MessageDeduplicator, type DedupStats } from "./message-deduplicator.js";
export { PlatformSessionState, SESSION_STATES, type SessionStateView } from "./session-state.js";
export { selector, requiredSelectors, syntheticProfile, type SelectorProfile, type SelectorEntry, type SelectorProvenance } from "./selector-profile.js";
export { SendAckRegistry } from "./send-ack-registry.js";
export { COMMON_COMMAND_ALLOWLIST, FORBIDDEN_COMMAND_TYPES, isAllowedCommand, dispatchCommand, type CommandHandlers } from "./dom-command.js";
export {
  buildPageReady, buildLoginRequired, buildDomUnsupported, buildConversationChanged,
  buildMessageReceived, buildHumanReplyDetected, buildSendAck, buildTransferAck,
} from "./dom-event.js";
export {
  domHealth, readConversation, listConversations, readMessages, readComposerState,
  sendText as domSendText, sendImage as domSendImage, detectHumanReply, executeTransfer as domExecuteTransfer,
  FALLBACK_TRANSFER_TEXT, toDomDocument, type DomHealthResult,
} from "./dom-drivers.js";
export { normalizeMessage, fallbackFingerprint, type NormalizeInput } from "./normalize.js";
export { PlatformPageRuntime, type PageTransport, type PageRuntimeOptions, type PageObserverLike } from "./page-runtime.js";
export { MiniEmitter, type Listener } from "./mini-emitter.js";
export { createPlatformAdapter, type PlatformPageBridge, type PlatformAdapterOptions, type GenericPlatformAdapter } from "./adapter-factory.js";
