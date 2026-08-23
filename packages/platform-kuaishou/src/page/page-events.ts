// M8 Kuaishou page events (clean-room, browser-safe). Generic builders bound to kuaishou.
export {
  buildPageReady as buildKuaishouPageReady,
  buildLoginRequired as buildKuaishouLoginRequired,
  buildDomUnsupported as buildKuaishouDomUnsupported,
  buildConversationChanged as buildKuaishouConversationChanged,
  buildMessageReceived as buildKuaishouMessageReceived,
  buildHumanReplyDetected as buildKuaishouHumanReplyDetected,
  buildSendAck as buildKuaishouSendAck,
  buildTransferAck as buildKuaishouTransferAck,
} from "@fastwork/platform-web-common";
