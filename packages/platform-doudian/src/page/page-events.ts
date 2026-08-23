// M8 Doudian page events (clean-room, browser-safe). Generic builders bound to doudian.
export {
  buildPageReady as buildDoudianPageReady,
  buildLoginRequired as buildDoudianLoginRequired,
  buildDomUnsupported as buildDoudianDomUnsupported,
  buildConversationChanged as buildDoudianConversationChanged,
  buildMessageReceived as buildDoudianMessageReceived,
  buildHumanReplyDetected as buildDoudianHumanReplyDetected,
  buildSendAck as buildDoudianSendAck,
  buildTransferAck as buildDoudianTransferAck,
} from "@fastwork/platform-web-common";
