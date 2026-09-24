> **DERIVED / REDACTED (2026-09-23).** Historical 2026-09-20 evidence, not an original byte-for-byte record or current authorization. See [package notice](../README.md).

# PDD 入站漏消息分析与解决路径

日期：2026-09-20（Asia/Shanghai）
结果：**PARTIAL** — 离线分析、反例验证和方案修正已完成；真实消息接收尚未修复。
范围：本轮用户请求的独立诊断，不启动、重开或关闭任何 SHEEP 任务。
代码基线：`79faea827fb6100a2860757ff61e838dbf9ac70a`，分支 `main`。本报告是诊断证据，不是新的产品/架构/授权权威。

## 1. 结论

**INFERRED（依赖附件观察准确）：根本问题不是轮询太慢，而是已观察的数据源只给“最新状态”，没有提供可核对的逐条消息增量/回放能力。**

要达到有边界、可验证的“不漏消息”，至少要能获得每条消息，并有启动、断线、观察器重启后的补偿机制。只看到最后一条、只看到通知或只增加请求频率，都不能单独证明完整性。

**CONFIRMED（离线反例）：方案 B 的“实时、不会漏”不成立。** 假设买家依次发送 M1、M2、M3，三个触发都准确到达，但三次查询都在 M3 到达后完成；若每次查询只返回最新值，结果均为 M3，去重后仍只有 M3。M1、M2 的正文不可能从这个快照中恢复。

**BLOCKED：当前工作区没有附件所说的 CDP 网络观察器源码、脱敏采集日志或可回放载荷。** 不能声称已定位那份观察器中的具体过滤错误，更不能假装已修复它。附件与工作区是否来自不同分支/机器/未提交版本：**INFERRED**。

## 2. 当前授权与写入范围

`project/PROJECT_STATE.json:790` 记录：

- `last_closed_task = SHEEP-300`。
- `SHEEP-301 = NOT_STARTED / NOT_AUTHORIZED`。
- `current_execution_authorization = false`。
- `current_live_evidence_authorization = PAUSED / NOT_AUTHORIZED`。
- 未找到当前已授权的独立 SHEEP 任务提示词路径；附件不是该授权的替代品。

本轮只读源代码、读取用户指定附件、查阅公开技术文档、运行本地纯函数与合成测试并生成诊断材料。未接入已登录卖家会话；未主动请求聊天接口；未点击会话；未发送、标已读、提交 ACK 或调用 AI Provider。

**INFERRED（环境映射）：** 宪法中的 Windows 项目根在本次 Mac 会话按用户提供的工作区 `REPO_ROOT` 对应处理。所有本轮项目写入均在该目录下的 `reports/` 与 `.tmp/`；未修改 Windows 根路径声明或任何治理文件。三个外部参考树未访问、未写入；它们在本机的存在及外部进程是否修改它们未做独立审计。

## 3. 附件证据应该怎样解读

| 材料中的说法 | 本轮分类与结论 |
|---|---|
| 连发三条后，列表响应只出现最后一条 | **INFERRED**：附件报告的现场结果，本轮未独立复现；符合快照而非消息日志的表现 |
| 180 秒内没有新增相关 HTTP 请求 | **INFERRED**：只能说明该观测窗口和覆盖范围，不代表平台永远不调用该接口 |
| 页面立即显示新消息，同时 Titan 二进制帧增加 2 个 | **INFERRED**：强候选线索，不能证明具体帧承载正文，也不能建立“每条消息 = 2 帧”规则 |
| iframe/worker、存储、长轮询均已排除 | **INFERRED**：需观察器实现、附加时序和脱敏覆盖证据才能独立确认 |
| `pre_msg_id` 一定能按前驱链取历史 | **BLOCKED**：没有协议文档证明其完整语义或可查询性；当前源码明确将其当不透明字段 |
| 前两条“永久错过” | **需修正文案**：当前快照路径没有捕获；是否仍可从平台历史补取尚未确认 |
| 已经发现没有历史接口 | **需修正文案**：尚未识别/确认历史接口，不等于接口不存在 |
| 只读观察必然无任何副作用或合规可用 | **PRODUCT_DECISION_REQUIRED**：观察动作与官方页面自身动作须区分，平台允许范围需确认；不能从技术只读推导平台许可 |

附件中的端点、时序和计数未被当作独立确认的 PDD 协议事实。

## 4. 当前代码实际做了什么

### 4.1 接收链路与附件不一致

**CONFIRMED：** 对当前 Git 跟踪的实现文件检索 `latest_conversations`、`orderCsGroupConvList`、`webSocketFrameReceived`、`Network.enable`，没有发现对应观察器实现。`titan-ws` 的匹配来自历史报告，不是生产接收器。

已读到的链路为：

```text
PddPageRuntime / MutationObserver
  -> readConversation + readMessages
  -> normalizeMessage + 内存 MessageDeduplicator
  -> message_received 页面事件
  -> typed page IPC / PddPlatformService
  -> PddOrchestratorBridge
  -> ConversationOrchestrator
```

- `packages/platform-pdd/src/selector-profile.ts:21`：选择器明确标注为 synthetic DOM contract / DESIGN；不是已验证的真实 PDD 聊天页选择器。
- `packages/platform-pdd/src/page/page-runtime.ts:120`：扫描消息、内存去重并发事件；当前路径不能作为完整后台消息接收的证明。
- `apps/desktop/src/main/platforms/pdd/pdd-platform-service.ts:72`：消费 `message_received`；未配置替代入口时流向旧 orchestrator bridge。
- `apps/desktop/src/main/bootstrap.ts:350`：当前构造参数未提供 `onInboundMessage` 持久化/新 envelope 入口。

### 4.2 已有真实载荷归一化函数，但它不是接收器

**CONFIRMED：** `packages/platform-pdd/src/inbound-normalizer.ts:52` 的 `normalizePddInbound` 会校验 `from.role=user`、`to.role=mall_cs`、数字字符串 `customerUid` 和非空 `msg_id`，并保留 `pre_msg_id` 等不透明字段。

它不做网络接收、重放、去重、持久化或完整 IdentityLock 构建；仓库调用点是导出和测试，没有生产调用点。`ts` 当前也没有进入 candidate 的来源时间字段。后续映射时不能用观察时间冒充平台发生时间。

### 4.3 旧测试链的限制不应带进新生产链

**CONFIRMED（代码及反例）：** `packages/platform-pdd/src/message-normalizer.ts:12` 在缺失平台 ID 时用店铺、会话、正文和时间生成指纹。同一会话中两条相同正文、缺失时间的真实独立消息会生成相同指纹；去重会合并。内存 dedup 重新实例化后也会重新接受此前 ID。

这说明旧 fixture 机制不能冒充权威消息 ID 或持久化游标；不证明附件观察器已经发生这个具体错误。

**DEFERRED：** 修复旧 DOM 路径、SHEEP-301 canonical mapping、SHEEP-302 durable ingestion、后续场景/AI/发送均未实施。新映射必须沿用现有 IdentityLock / InboundEnvelope，不创建第二套模型；`customerUid != internalConversationId`，runtime shop 不自动等于 canonical Store。

## 5. 公开技术资料核对

### 5.1 CDP 二进制观察的确定事实

**CONFIRMED（Chrome DevTools 官方协议）：** `Network.WebSocketFrame.payloadData` 在 `opcode == 1` 时是文本，其余 opcode 的内容以 base64 字符串呈现。对二进制消息应先恢复字节，而不是把该字符串当作原始 JSON/UTF-8 内容。

官方类型虽然名为 WebSocketFrame，说明它代表完整 WebSocket message，而非要求客户端自行按网络碎片拼接的单个片段。这也不能证明 Titan 的应用层业务消息与 CDP 事件一一对应。

公开来源（2026-09-20 检查）：
- `https://chromedevtools.github.io/devtools-protocol/tot/Network/`
- `https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json`

本轮直接读取官方协议 JSON，确认 `Network.WebSocketFrame` 与 `webSocketFrameReceived` 定义。**没有证据证明当前缺失的观察器存在 base64 解码错误**，这只是应核查的实现点。

**BLOCKED：** `opcode=2` 不能确定 protobuf、压缩、加密、心跳业务类型；可见字符串也不足以推出完整 schema。未解码 Titan，未猜测 protobuf 字段、密钥或私有 RPC 参数。WebSocket 传输层压缩与应用层压缩也不应混为一谈。

### 5.2 拼多多官方客服能力

**BLOCKED：** 公开检索和开放平台页面访问未获得足够的官方客服入站消息订阅、历史补取、申请资质及副作用规范。页面 HTTP 200 返回的是应用壳，不能作为客服 API 可用性的证据。

已检查入口：
- `https://open.pinduoduo.com/`
- `https://open.pinduoduo.com/application/document/browse?idStr=15A9A7C2DAAC7DA3`

结论是“尚未确认”，不是“开放平台没有客服能力”。未引用第三方猜测端点，未提供虚构接口名、权限名或频率阈值。

## 6. 修正后的解决方案（待授权，不是已实现架构）

### 第一选择：官方授权的消息来源 + 补偿能力

**INFERRED / 建议：** 优先确认官方是否提供面向该应用类型的客服 SDK、事件订阅或接口。必须一起确认实时和补偿契约，不能只确认“能收到一条”。若事件会丢且不能回放，仍不能承诺覆盖断线区间。

### 第二选择：获准的网页消息源 + 已确认的只读完整回放

**INFERRED / 条件建议：** 仅在平台许可及 Controller 授权后，核查网页实际接收到的逐条事件，或以已确认的新消息通知触发完整历史/增量同步。历史读取必须有可验证的会话范围、分页/游标、时间及副作用语义。

- Titan 通知最多先视作“可能有变化”的提示，不按帧数创建客户消息。
- 若 Titan 直接携带正文，也要解决观测之前/断线期间的补偿。
- 若只拿到事件提示，必须配合真正的逐条增量/历史源，不能继续只读 latest 快照。
- 不通过遍历点击会话来补齐数据；打开会话可能触发已读、分配或其它动作，当前均未知。
- 不在没有证明前发起私有历史请求、自动 ACK、标已读、协议逆向接入或提高轮询频率。

### 两条路线都必须满足的验收设计

以下是**INFERRED / 待审建议**，不是本轮实施或产品授权：

1. **启动衔接**：先建立事件缓冲，再取得回放窗口/水位；合并重叠区，避免“先拉历史后订阅”的间隙。具体算法服从真实源的游标契约。
2. **逐条处理**：平台身份、平台消息 ID、方向、源时间独立解析；不能用当前选中的买家给所有后台消息绑定身份。
3. **完整分页**：直到覆盖已确认水位或得到可验证终止条件；不以“本次只返回一条”作为已追平证明。
4. **去重与提交**：使用权威源定义范围内的消息 ID，隔离 merchant/store/platform account/customer；先持久化成功再推进水位。事务、幂等和恢复细节交由已授权持久化任务审定。
5. **断线恢复**：重连后回放、重叠去重；权限变化、过期、保留窗口越界、游标失效及持久化失败不标记为“已追平”。
6. **缺口显式化**：当前覆盖不可证明时保留原因，通知人工；不得让 AI 基于“最后一条”假装理解完整会话。具体状态/策略属于后续受控实现。
7. **不制造第二套基础设施**：以上逻辑封装在现有 adapter/Main ingestion 边界内；不新增微服务、Cloud 同步或强制 transport-strategy 抽象。

如果既无逐条消息源，也无完整回放能力，应明确判定后台完整接收暂不具备条件。不能以更频繁的快照轮询作为最终修复。

## 7. 下一步最小证据与决策包

### BLOCKED：版本与证据

需要文档对应的观察器所在分支/提交号或确切源文件。优先提供代码与只用自发测试消息的最小回放夹具；不要提供完整浏览器 profile、Cookie、Token、请求头、带 query 的认证 WS URL 或未经审查的原始二进制包。

即便 payload 是二进制或 base64，也可能含敏感内容；不能因肉眼看不懂而当作脱敏。补充材料应在本地先审查，只保留必要事件类型、相对时序、源范围及合成/脱敏身份和消息关联。业务日志也不要记录完整聊天正文。

### PRODUCT_DECISION_REQUIRED：下一次诊断权限

- 问题：是否授权单店、自发测试消息、禁止发送/已读/主动聊天请求的有界 live 证据诊断？
- 重要性：当前治理已暂停 live，不能由附件或本报告解除。
- 已确认：当前状态与缺失的观察器版本；离线 23 项验证。
- 未知：Titan schema、历史能力、平台许可、打开会话副作用。
- 选项：A 官方授权 SDK/接口；B 经平台确认和 Controller 授权的网页观测/补偿；C 暂停完整后台接收承诺，继续人工处理。
- 建议：先拿到对应代码；向平台同时确认实时、补偿和副作用。官方路径满足条件时优先 A。
- 可逆性：离线分析 HIGH；live 与数据操作需单独界定。
- Implementation Performed：**NO（生产实现）**。
- 阻塞：SHEEP-301 对真实 producer 的证明及其后完整入站验收；本轮没有启动这些任务。

### 可直接发给拼多多技术方的精简确认项

1. 是否存在该应用类型可申请的逐条客服入站事件或 SDK？需哪些权限/资质，能否覆盖非当前选中会话？
2. 能否提供会话级历史/增量回放？请明确接口/SDK 方法、授权范围、分页/游标、保留窗口与终止条件。
3. 推送的重复、乱序、断线续传和离线消息语义是什么？消息 ID 的唯一范围是什么？
4. `pre_msg_id` 的准确语义是什么？能否用于补洞，还是仅关联信息？
5. 历史读取、打开会话、传输 ACK、业务已读分别有哪些副作用？是否影响未读或平台指标？
6. 该商家网页的 Titan 通道是否为客服事件源？若允许第三方使用，是否有官方解码 SDK/协议，而非要求猜测私有结构？
7. 若允许观测或调用，限流、并发、回放窗口、重试/退避及风控边界应遵循哪份规范？

## 8. 验证结果与下一轮验收标准

**CONFIRMED：23/23 离线测试通过。**

- 13 项现有测试：入站候选归一化、缺失身份/错误角色拒绝、指纹、顺序、内存去重。
- 10 项补充验证：latest-only 漏消息反例、完美触发仍漏、轮询间隙、假设性完整回放模型、不透明前驱、心跳不等于客户消息、身份不臆造、同文指纹合并、重启后去重失效、CDP base64 字节恢复。
- 反例测试“通过”表示正确复现限制，**不表示限制已修复**；假设性回放模型不证明 PDD 有该 API。
- 运行方式：使用随工作区工具提供的 Node v24.19.0，将三个源码模块和对应测试转换到项目 `.tmp/`；原有断言逻辑未改动，无依赖安装。
- 原源码和原测试文件哈希未变化。
- Node 提示 `stripTypeScriptTypes` 为实验特性；未隐藏该限制。
- 完整 TypeScript 编译、完整包测试、DOM/Electron smoke、真实店铺接收、断线回放、跨店 live 及平台副作用验证：**NOT_RUN**。本机没有项目安装依赖或构建产物，live 同时未获授权。

后续获得授权后的测试至少覆盖：同一客户连发不同/相同文本、非当前会话、多客户交错、启动瞬间到达、断线/重启补偿、分页边界、重复/乱序、会话/店铺切换、失效游标、缺失 ID、未知格式、持久化失败和过期登录。以发送的合成测试消息集合与持久化集合做逐 ID 对账；要求零误归属、零静默缺口、幂等收敛；除明确的许可范围外零平台动作。

复跑：

```sh
LOCAL_TOOL_RUNTIME_NOT_INCLUDED reports/public-inbound-evidence-2026-09-23/pdd-inbound-analysis-2026-09-20/verify-offline.mjs
```

证据：`offline-tests.tap`、`offline-validation.json`、`report.json`，与本文件同目录。

**next_stage_not_executed = true**
**Do not start the next SHEEP task. Wait for Controller PASS / REPAIR.**
