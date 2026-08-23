// M8 JD page events (clean-room, browser-safe). Generic builders bound to jd.
export {
  buildPageReady as buildJDPageReady,
  buildLoginRequired as buildJDLoginRequired,
  buildDomUnsupported as buildJDDomUnsupported,
  buildConversationChanged as buildJDConversationChanged,
  buildMessageReceived as buildJDMessageReceived,
  buildHumanReplyDetected as buildJDHumanReplyDetected,
  buildSendAck as buildJDSendAck,
  buildTransferAck as buildJDTransferAck,
} from "@fastwork/platform-web-common";
