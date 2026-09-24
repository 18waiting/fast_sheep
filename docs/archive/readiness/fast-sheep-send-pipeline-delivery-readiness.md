# Message Send Delivery-Contract Readiness（SHEEP-066 Read First）

> **时点导航（2026-09-24）**：本文的 `STOP / DEFER` 是 SHEEP-066 Read First 时点判断。后续 [SHEEP-066-PR1](fast-sheep-text-delivery-attempt-foundation.md) 的 durable attempt/typed outcome 基础获 `PASS`，[SHEEP-066-PR2](fast-sheep-manual-send-authorization-readiness.md) 的授权审查获 `PASS`；真实平台 delivery/ACK 与生产 Composer Send 仍未因此启用。 当前任务状态/授权以 [PROJECT_STATE.json](../../project/PROJECT_STATE.json) 为准；验收溯源见 [对应报告](../reports/SHEEP-066-report.json)。

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 · 日期：2026-08-28
> 定位：SHEEP-066 本轮仅执行 **Read First / Delivery-Contract Readiness**（Owner 收紧：Option A/B 暂不批准实施，Composer Send 继续 disabled）。
> 结论：**STOP / DEFER**——核心 delivery 项不足；不得为了 Roadmap 完成度打开 Send。
> 边界：不改 schema v9；不实现 Option A/B；不开 Composer Send / busy/success/failure/retry UI；无 visual evidence；I-32 硬锁 text-only。

## 1. 决策契约（本轮记录，待 Owner PASS）

| DP / I | 决策 |
|---|---|
| DP-119 | SEND_PIPELINE_CONSUMES_COMPOSER_SUBMIT_INTENT（唯一输入 = SHEEP-064 原子捕获 `{conversationId, draft}`；I-30） |
| DP-120 | SEND_AUTHORIZATION_PRECEDES_DELIVERY_AND_MESSAGE_PERSISTENCE（Main 先做 WorkspaceMerchant containment + 既有真实 authorization/capability/entitlement/platform capability 检查；不自行发明新 taxonomy） |
| DP-124 | MANUAL_AGENT_SEND_AUTHORITY_IS_DISTINCT_FROM_AI_AUTOMATION_LEVEL（HUMAN_ONLY/AI_SUGGEST/AI_AUTO_REPLY/FORCE_HANDOFF 是 AI automation policy，不经既有明确 policy evidence 不得直接作为人工 Composer send deny/allow） |
| DP-122/125 | SEND_OUTCOME_IS_EXPLICIT_AND_TYPED_NOT_BOOLEAN（至少 ACKNOWLEDGED / REJECTED / UNKNOWN；词表可随真实 driver evidence 调整） |
| I-33 | UNKNOWN_DELIVERY_OUTCOME_MUST_NOT_AUTO_RETRY_OR_PERSIST_AS_SENT（保留 draft；不自动 retry；不写 delivered Timeline fact） |
| DP-126 | DELIVERED_MESSAGE_FACT_REQUIRES_AUTHORITATIVE_DELIVERY_OUTCOME（仅当 delivery contract 足以证明 outbound 已发生时，才经 ingestion boundary 写 actor=agent/text fact） |
| I-28 细化 | sent = acknowledged success（ACKNOWLEDGED 可清 captured conversation draft；REJECTED/UNKNOWN 保留；c1 outcome 不影响 c2） |

## 2. Read First 证据

### 2.1 TEXT_DELIVERY_DRIVER_READINESS = NOT_READY
- 存在 DOM 文本发送路径：`PddPlatformAdapter.sendText` → page bridge `send_text` → `sendText(doc, profile, conversationId, text)`（设置 input value + dispatch input events + click send + 读取 `[data-fw-pdd-send-ack]`）。
- **问题**：`ok:true` 仅表示 DOM input 已设置 + send 已点击 + Fast Sheep 注入的 ack 标记存在（frozen baseline 注释明确 "Deterministic ack from the synthetic DOM contract"）。**非平台权威 delivery outcome**；`uncertain` 字段存在于 `SendResult` 但**未被使用**；无 read-back 验证消息确实进入会话；未绑定/核验 authoritative conversation/store/platform account delivery 状态。

### 2.2 DELIVERY_ACK_READINESS = NOT_READY
- `SendAttempt = { ok: boolean; messageId?: string; error?: unknown }` —— **布尔 + messageId**，无 ACKNOWLEDGED/REJECTED/UNKNOWN。
- ack 来自 `[data-fw-pdd-send-ack]`（fixture/合成 DOM 契约）；真实平台无该元素时 `message_id` 回退为 `commandId`（Fast Sheep 命令 id，非平台消息 id）。
- `SendAckRegistry`（60s 内存）仅用于 takeover 检测分类，不是 delivery outcome。

### 2.3 MANUAL_SEND_AUTHORIZATION_READINESS = PARTIAL
- 已有：WorkspaceMerchant containment（PR2）、conversation identity、session ready、declared platform capability（`send_text`，doudian PARTIAL certainty）。
- **缺口**：Entitlement / ResourceScope 模型不存在（DEC-012 方向但未实现）；按 DP-120 **不得自行发明**新 capability/entitlement taxonomy。DP-124：manual agent send authority ≠ AI automation level（无明确 policy evidence 前不得用 automation level 直接 gate 人工发送）。

### 2.4 RETRY_IDEMPOTENCY_READINESS = PARTIAL
- 已有：bridge 层 commandId 幂等（"Idempotency: bridge ack carries the deterministic message id"）。
- **缺口**：无 durable send-attempt journal；无 reconciliation contract；UNKNOWN outcome 处理缺失（I-33 禁止自动 retry）；retry 非默认能力。

### 2.5 DURABLE_SEND_ATTEMPT_READINESS = NOT_READY
- 无 durable send-attempt/delivery journal（无 Outbox；0008 仅 message facts；send-ack registry 为 60s 内存）。
- crash window（send-click 与 delivery 确认之间）无法恢复；若需处理，须提交**最小 delivery-attempt prerequisite**；不得把 send intent 写成 delivered message，不得实现 Cloud Sync Outbox。

## 3. Decision Package（等待 Owner）
1. **Option A（真实 platform driver delivery）DEFER**：需真实 platform driver 提供 authoritative delivery/ack semantics（当前不可证实）。
2. **Option B（send-record）不批准**：不得以"记录 send-record"冒充真正 Send Pipeline；不建未治理的 send-record domain。
3. **Composer Send 保持 disabled**；不开 busy/success/failure/retry UI。
4. 若未来推进，最小 prerequisite：durable delivery-attempt journal + typed ACKNOWLEDGED/REJECTED/UNKNOWN outcome + 真实平台 ack read-back + reconciliation；先经 Owner 单独批准。

## 4. 边界
- 未改 schema（v9）；未实现 Send Pipeline / Option A/B / busy-success-failure-retry UI；未实现 attachment（I-32 text-only）；未实现 Outbox/sync；未改已 PASS Composer/I-27~I-30。
- Renderer 不接触 SQLite；未联网；未读 nixiang（仅读冻结技术基线 rebuild，read-only）。
