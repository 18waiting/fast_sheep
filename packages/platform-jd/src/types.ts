// M8 JD platform (clean-room). Re-exports shared generic types bound to jd.
export type {
  PlatformSessionStatusValue, MessageDirection, NormalizedInboundMessage, RawDomMessage, RawDomScan,
  PlatformPageEvent, PlatformPageCommand, PlatformPageCommandResult, SendResult,
  TransferExecutionResult, AutomatedSendAck, DomElement, DomDocument, ConversationRead, ComposerState,
} from "@fastwork/platform-web-common";
export type { PlatformCapabilities } from "@fastwork/platform-web-common";
export type { SendAttempt, TransferDecision } from "@fastwork/orchestrator";
export type { GenericPlatformAdapter as JDPlatformAdapter } from "@fastwork/platform-web-common";
