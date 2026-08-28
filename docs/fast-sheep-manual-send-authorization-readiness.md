# Manual Text Send Authorization Contract Readiness（SHEEP-066-PR2 Read First）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 prerequisite · 日期：2026-08-29
> 定位：纯 Read First / Authorization Contract Readiness——核验并收敛人工 text send 所需的**现有** authorization 机制；不实现权限系统、不接真实 delivery driver、不启用 Composer Send、不改 schema v10。
> 结论：**NOT_READY / PRODUCT_DECISION_REQUIRED**（Authorization Capability / ResourceScope / Entitlement 均无实现或需求未证实）；production Send 保持 unavailable（DP-129）。
> 边界：0 product code、0 UI、0 visual evidence；不为验证创建 authorization service / policy engine / entitlement checker。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-131 | AGENT_AUTHORIZATION_CAPABILITY_AND_PLATFORM_TECHNICAL_CAPABILITY_ARE_SEPARATE_GATES（`send_text` 是 Platform Technical Capability，非 Agent Authorization Capability） |
| DP-132 | MANUAL_SEND_ENTITLEMENT_REQUIREMENT_MUST_BE_EVIDENCED_NOT_INFERRED_FROM_THE_EXISTENCE_OF_ENTITLEMENTS |
| I-42 | MANUAL_SEND_AUTHORITY_IS_RESOLVED_FROM_THE_CONVERSATION_NOT_AMBIENT_QUEUE_SCOPE（Renderer/Composer submit 仅 {conversationId,draft}；Store/PlatformAccount authority 由 Main resolve Conversation 获得） |
| I-43 | WORKSPACE_MERCHANT_CONTAINMENT_DOES_NOT_IMPLY_RESOURCE_SCOPE_AUTHORITY |
| DP-124 | AI AutomationLevel 不直接 gate Manual Agent Send（继续成立） |

## 2. Read First 证据（7 项 readiness）

### 2.1 MANUAL_SEND_WORKSPACE_TARGET_AUTHORITY_READINESS = READY（基础）
- 事实源：`WorkspaceMerchantContext`（PR2）+ identity domain（Conversation/Store/PlatformAccount repos）+ PR1 attempt target（I-37 捕获 store/platform_account）。
- 语义：Conversation 属于当前 merchant（containment）+ Main resolve Conversation 得到 Store/PlatformAccount authority（I-42）。**I-43：containment ≠ ResourceScope**。

### 2.2 MANUAL_SEND_AUTHORIZATION_CAPABILITY_READINESS = NOT_READY
- 事实源：无 Agent Authorization Capability 模型；`platform-capability-registry.send_text` 是 **declared Platform Technical Capability**（DP-131），非 Agent Authorization Capability。
- 缺失语义：无 `SEND_MESSAGE`/`conversation.send` 类授权 capability taxonomy；不得自造。

### 2.3 MANUAL_SEND_RESOURCE_SCOPE_READINESS = NOT_READY
- 事实源：无 ResourceScope implementation。
- 缺失语义：不得用 Queue Store filter / selected shop / All Stores / merchant containment 冒充 ResourceScope（I-43 / 收紧 #6）。

### 2.4 MANUAL_SEND_ENTITLEMENT_REQUIREMENT_READINESS = PRODUCT_DECISION_REQUIRED
- 事实源：无证据表明人工 text send 需要 `manual_send` entitlement（DP-132：不得因系统有 Entitlement 概念就推断需求）。

### 2.5 MANUAL_SEND_ENTITLEMENT_IMPLEMENTATION_READINESS = NOT_READY
- 事实源：无 Entitlement implementation（DEC-012 方向仅记录）。

### 2.6 PLATFORM_TEXT_SEND_TECHNICAL_CAPABILITY_READINESS = PARTIAL
- 事实源：`send_text` declared（pdd 硬编码 true；doudian `DOUDIAN_CAPABILITY_CERTAINTY.send_text=PARTIAL`）；session ready 存在（PddPlatformAdapter.sendText 检查 `session.isReady()`）。
- 语义：session ready 只证明 technical readiness，不授予 Agent authority（收紧 #11）；DP-131 与 authorization capability 分离。

### 2.7 MANUAL_SEND_AUTHORIZATION_COMPOSITION_READINESS = NOT_READY
- 语义：Authorization Capability + ResourceScope + Entitlement 任一缺失都使组合不可授权；production Send 保持 unavailable（DP-129）。

## 3. Gate Matrix（收紧 #13）

| Gate | 问题 | 真实事实源 | Readiness | 缺失时语义 |
|---|---|---|---|---|
| Workspace target authority | Conversation 是否属于当前 Merchant；Store/PlatformAccount 是否来自该 Conversation | WorkspaceMerchantContext + identity repos + PR1 attempt target | READY（基础） | 不满足则 deny（不 Send） |
| Authorization Capability | 是否有证据化的 Agent 授权 capability（非 Platform technical） | 无（`send_text` 是 technical） | NOT_READY | 无证据 -> 不可授予人工 send authority（DP-131） |
| ResourceScope | 是否有 ResourceScope 事实源限定 store/platform 范围 | 无 | NOT_READY | 不得用 Queue/selected shop/All Stores/containment 冒充 |
| Entitlement requirement | 人工 text send 是否确有 entitlement 需求 | 无证据 | PRODUCT_DECISION_REQUIRED | 未证实需求前不建 `manual_send` entitlement（DP-132） |
| Entitlement implementation | 是否有 Entitlement 实现可查 | 无 | NOT_READY | 无实现 -> 无 entitlement gate |
| Platform text send technical | `send_text` 是否真实可执行（非仅声明） | capability registry（pdd declared / doudian PARTIAL） | PARTIAL | session 就绪只证明 technical；不授予 authority（#11） |
| Authorization composition | 上述 gate 能否组合成可判定的人工 send 授权 | 缺 2/3/4/5 | NOT_READY | 任一缺失 -> production Send unavailable（DP-129） |

## 4. Decision Package（等待 Owner）
1. **不实现**权限系统 / authorization service / policy engine / entitlement checker（本轮 0 code）。
2. **Composer Send 全程 disabled**（DP-129）；不接真实 delivery driver；ACK 仍 NOT_READY（继承 SHEEP-066，DP-129 有效）。
3. Owner 决策点：建立**最小 authorization prerequisite**（需先有证据化的 Authorization Capability/ResourceScope/Entitlement 需求模型）vs **Product Decision**（entitlement 需求是否真实）vs **DEFER**（直到真实多商户/订阅/授权需求出现）。

## 5. 边界
- 未改 schema v10；未实现 Send Pipeline / retry / busy-success-failure UI / attachments / Outbox / sync；未改已 PASS Composer/I-27~I-30、PR1/I-33~I-41。
- Renderer 不接触 SQLite；未联网；未读 reference/nixiang。
