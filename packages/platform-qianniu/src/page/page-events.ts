// M8 Qianniu page events (clean-room, browser-safe). Generic builders bound to qianniu.
export {
  buildPageReady as buildQianniuPageReady,
  buildLoginRequired as buildQianniuLoginRequired,
  buildDomUnsupported as buildQianniuDomUnsupported,
  buildConversationChanged as buildQianniuConversationChanged,
  buildMessageReceived as buildQianniuMessageReceived,
  buildHumanReplyDetected as buildQianniuHumanReplyDetected,
  buildSendAck as buildQianniuSendAck,
  buildTransferAck as buildQianniuTransferAck,
} from "@fastwork/platform-web-common";
