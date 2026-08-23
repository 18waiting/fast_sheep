// M8 Xianyu page events (clean-room, browser-safe). Generic builders bound to xianyu.
export {
  buildPageReady as buildXianyuPageReady,
  buildLoginRequired as buildXianyuLoginRequired,
  buildDomUnsupported as buildXianyuDomUnsupported,
  buildConversationChanged as buildXianyuConversationChanged,
  buildMessageReceived as buildXianyuMessageReceived,
  buildHumanReplyDetected as buildXianyuHumanReplyDetected,
  buildSendAck as buildXianyuSendAck,
  buildTransferAck as buildXianyuTransferAck,
} from "@fastwork/platform-web-common";
