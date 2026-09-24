> **DERIVED / REDACTED (2026-09-23).** Historical 2026-09-20 evidence, not an original byte-for-byte record or current authorization. See [package notice](../README.md).

# PDD-customer-bot 参考核验

日期：2026-09-20。范围：公开源码静态审阅；不是生产修复，也不是 live 接入验证。

## 证据边界

- Zread 页面读取超时；改为核验其对应 GitHub 仓库，未把生成式摘要视作实现事实。
- 仓库：clarencejh/PDD-customer-bot；GitHub metadata 确认为 JC0v0/Customer-Agent 的 fork。
- 当前 main 快照：edcebdf793b0c0fbd286256f09187b7f0742ca7c，提交时间 2026-09-03T13:49:00Z，Beta 3。
- 当前提交内 118 个 Python 文件的只读关键词扫描成功 108 个；10 个获取超时，未据此宣称全仓不存在某能力。接收、生命周期、队列、归档、模型及主回归测试等关键文件已直接读取。
- 未安装或运行第三方程序/测试，未读取其真实配置或会话数据，未连接商家。静态测试用例阅读不是测试通过证据。

## PRODUCT_ALIGNMENT

PRODUCT_ALIGNMENT: 研究稳定入站与 AI 处理可靠性，服务 AI-first 客服闭环。
CURRENT_MVP_RELEVANCE: PDD 实时逐条接收、身份隔离和恢复能力。
CUSTOMER_VALUE: 降低漏消息、重复处理及故障后无法追溯的风险。
SAFETY_IMPACT: 仅公开资料静态分析，不增加发送/已读/ACK/登录授权。
OUT_OF_SCOPE: 运行第三方机器人、移植凭据、live 接入、启动 SHEEP-301 或恢复 SHEEP-091。
DECISION: PROCEED

## CONFIRMED

1. **不同传输路径**：ConnectionMixin 使用 m-ws；LifecycleMixin 自建连接，消息处理器直接 json.loads。关键接收链未实现 Titan 二进制解析。成功回调发生在启动接收循环前，不能仅以连接成功判断业务消息可达。[S1-S3]
2. **先归档、后路由**：解析后先调用 archive_context，再分流系统事件与 AI 业务队列；归档数据带平台消息 ID、店铺/账号和方向；数据库有组合唯一约束。它的本地归档与 LLM 上下文分离。[S3-S5]
3. **归档不等于耐久处理闭环**：append 在普通数据库异常时返回 None；上游不检查该返回值。队列满时会拒绝入队。代码不能据此证明每条消息会最终被业务处理。[S3,S4,S6]
4. **去重条件有限**：队列优先按 msg_id 去重；缺 ID 时使用渠道、用户及正文。缓存是内存结构，会定期整体清空。[S6]
5. **Beta 3 分页是本地分页**：latest_record_id 查询本地 ConversationRecord 的最大自增 ID；列表/记录查询使用数据库 offset/limit。这不是拼多多历史消息补拉接口。[S4,S8]
6. **受控并发**：接收侧限制 pending tasks，消费侧使用固定 worker；存在相关静态回归测试。未运行这些测试。[S2,S7,S9]
7. **并非只读观察器**：撤回/转接事件分支存在发送消息行为；不能直接运行它来做快羊的被动接收诊断。[S3]

## INFERRED：借鉴与限制

- 值得借鉴：入站记录独立于 AI 上下文；先持久化再分发；平台消息 ID 幂等；明确的账号/店铺作用域与有界并发。
- 快羊需加强：只有持久化成功才允许后续处理；可恢复的待处理任务与重试；不能用无 ID 的同正文作为确定重复；沿用既有 IdentityLock/InboundEnvelope，不移植第二套身份权威。
- 无 ID 时，同一客户连续发送相同正文可能在 AI 队列被误合并；这与归档是否保存是两个问题，不能统称网络漏收。
- m-ws 可列为未来待授权验证的候选，不能替代附件中的 Titan 证据链；这个 fork 不是上一轮 Customer-Agent 以外的独立协议验证。
- 本地历史分页不能追回根本没接收到的数据。关键接收链未找到平台历史回放/持久游标恢复证据；不承诺断线或启动前消息完整。

## BLOCKED / PRODUCT_DECISION_REQUIRED / DEFERRED

- BLOCKED：附件观察器未在本工作区定位；没有当前账号/版本的 live 接收验证；Zread 页面和 10 个 Python 文件此次未成功取得。
- PRODUCT_DECISION_REQUIRED：独立连接方式的平台许可、账号并发影响、凭据和执行权限边界，必须按现有治理确认；不由第三方实现自动授权。
- DEFERRED：源码移植、任何新登录连接/主动消息请求、ACK/已读/发送、生产修复及下一 SHEEP 任务。
- README 标注 MIT，但 GitHub license metadata 为 null；若未来复用源码，应另行核验完整许可与依赖，不在本次作许可结论。

## 来源（固定提交，按行复核）

固定基址：
https://github.com/clarencejh/PDD-customer-bot/blob/edcebdf793b0c0fbd286256f09187b7f0742ca7c/

- S1: Channel/pinduoduo/core/pdd_connection.py，L9-L71。
- S2: Channel/pinduoduo/core/pdd_lifecycle.py，L144-L215、L495-L541。
- S3: Channel/pinduoduo/core/pdd_message_handler.py，L58-L123、L144-L163。
- S4: database/conversation_archive.py，L101-L116、L131-L198、L332-L363、L465-L475。
- S5: database/models.py，L130-L164。
- S6: Message/core/queue.py，L22-L63、L110-L160。
- S7: Message/core/consumer.py，L20-L88、L113-L154。
- S8: 当前提交说明；ui/conversation_ui.py 的 latest_record_id 调用（L627）。
- S9: tests/test_regressions.py，L965、L978、L1140、L1200 起的相关用例。

## 验证状态

研究结果：PARTIAL（实现和局限已给出源码依据；Zread/部分扫描资料缺失；不表示实际接收已修复）。
生产/集成/live 测试：NOT_RUN。第三方源码测试：NOT_RUN。
现行状态重新核对：SHEEP-301 NOT_STARTED / NOT_AUTHORIZED；current_execution_authorization=false；live PAUSED / NOT_AUTHORIZED。
next_stage_not_executed = true。
仅新增本报告及配套核验清单；生产代码、治理文件、原附件未修改；外部只读参考树未访问。
