> **DERIVED / REDACTED (2026-09-23).** Historical 2026-09-20 evidence, not an original byte-for-byte record or current authorization. See [package notice](../README.md).

# PDD 消息接收公开案例核验（2026-09-20）

## 范围和结果

- 请求：检索其他人是否遇到类似问题、公开解决方式及近期有效性。
- 结果：PARTIAL。已找到相近问题和实现线索；未证明附件问题已修复，未找到与附件全部条件一致且验证不漏收的公开复现。
- 方法：网页检索；只读 GitHub 官方 API / raw 源文件，核对 issue 评论、提交日期和具体代码；不执行第三方代码。
- 当前授权重新核对：SHEEP-301 NOT_AUTHORIZED；live PAUSED / NOT_AUTHORIZED；next_stage_not_executed = true。
- 本轮未连接店铺、操作客服页面、复制登录凭据或真实聊天记录；未修改生产源码或项目治理状态；未访问外部参考树。

## CONFIRMED：已核验的公开事实

1. JC0v0/Customer-Agent issue #23（2026-06-01）：连接成功、仅见 auth 的相近反馈。2026-06-02 的维护者建议排查电脑客户端与机器人同时在线；评论中未见提问者确认解决。不能推导为全部接入方式的通用限制。
2. TiTjsq/pdd-auto-reply：2026-04-09 提交快照包含 CDP 二进制帧诊断、gzip 候选提取、notify JSON 和 push_data 处理。它是可核验的实现线索，不是完整 Titan 协议或生产可靠性证明；ASCII 过滤步骤不宜用于保真正文解析。
3. zhinianboke/pdd-auto-reply：历史模块首次提交于 2026-06-11，使用 /plateau/chat/list、start_msg_id、has_more 和消息 ID 去重。代码对非首页失败可返回部分数据且 success=true，不能据此宣称完整同步。notUpdateUnreplyTs 字段也不能证明没有已读等副作用。
4. Chromium CDP Network 协议：WebSocketFrame.payloadData 在 opcode=1 时是 UTF-8 文本，其余为 Base64；这是传输层格式，不是 Titan 的业务 schema。

## INFERRED：对快羊的意义

- 优先核验已有授权、脱敏样本能否还原逐条消息，而非将 Titan 仅作为 latest 快照触发器。
- 历史补偿有具体公开线索；start_msg_id 与现有 pre_msg_id 不得未经验证混用。
- 候选方向：逐条实时输入 + 经验证的历史分页回补 + 按权威身份/消息 ID 幂等入库。

## BLOCKED / DEFERRED

- BLOCKED：本机附件观察器实现未定位；没有经过授权的 Titan 实际样本验证与历史接口契约验证。
- BLOCKED：尚未确认正式开放平台是否提供适用能力，以及具体资质、额度、权限与副作用。
- DEFERRED：任何 live 调用、客户端并发切换实验、自动 ACK/已读/发送及生产接入修改。
- PRODUCT_DECISION_REQUIRED：商业接入渠道与平台权限必须按现行治理确认，不能以第三方代码替代授权。

## 可复核来源（源码固定到核验快照）

- Issue 与维护者评论：https://github.com/JC0v0/Customer-Agent/issues/23
- Electron CDP / gzip 处理：https://github.com/TiTjsq/pdd-auto-reply/blob/e496efe8197fd674e017e9e67ae6f995620e06e6/src/main/network-monitor.js#L233-L343
- notify 消息提取：https://github.com/TiTjsq/pdd-auto-reply/blob/e496efe8197fd674e017e9e67ae6f995620e06e6/src/main/main.js#L616-L646
- 历史分页与持久化：https://github.com/zhinianboke/pdd-auto-reply/blob/61dac37fb6c329ca397c8bb03d274421254b1498/websocket/channel_pdd/api/get_chat_history.py
- 历史模块初始提交：4180d181d4b2eb2ac24911f14f4f8b01480fa088，2026-06-11T09:12:16Z。
- CDP 官方协议：https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-WebSocketFrame

注意：仓库 updated_at 可能由非代码活动更新，未将其用作修复日期；Customer-Agent 最新提交为 2026-08-12 的店铺 logo / 代理 DNS 修复，不是消息接收修复。上述实现是否仍适用于当前账号/客户端版本，没有 live 验证。
