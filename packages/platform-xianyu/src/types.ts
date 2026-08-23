// M8 Xianyu platform (clean-room). Re-exports shared generic types bound to xianyu.
export type {
  PlatformSessionStatusValue, MessageDirection, NormalizedInboundMessage, RawDomMessage, RawDomScan,
  PlatformPageEvent, PlatformPageCommand, PlatformPageCommandResult, SendResult,
  TransferExecutionResult, AutomatedSendAck, DomElement, DomDocument, ConversationRead, ComposerState,
} from "@fastwork/platform-web-common";
export type { PlatformCapabilities } from "@fastwork/platform-web-common";
export type { SendAttempt, TransferDecision } from "@fastwork/orchestrator";
export type { GenericPlatformAdapter as XianyuPlatformAdapter } from "@fastwork/platform-web-common";
