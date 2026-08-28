# Text Delivery Attempt & Outcome Foundation（SHEEP-066-PR1）

> 项目：Fast Sheep / 快羊客服 · Phase 4 / M4.2 prerequisite · 日期：2026-08-29
> 定位：SHEEP-066 前置单元——建立 **platform-independent Send Attempt truth model / typed outcome / durable recovery contract**；**不实现真实平台 delivery、不启用 Composer Send**。
> 依据：Owner 批准 PR1（含 v10 migration 授权）；DP-119/120/122/124/125/126/127/128/129/130 + I-33~I-41。
> 边界：不改已 PASS Composer/I-27~I-30；I-32 text-only；production Send 保持 disabled（DP-129）。

## 1. 决策落地

| DP / I | 决策 | 落地 |
|---|---|---|
| DP-119 | SEND_PIPELINE_CONSUMES_COMPOSER_SUBMIT_INTENT | attempt 输入 = `{conversationId, textPayload}`（I-30） |
| DP-120 | SEND_AUTHORIZATION_PRECEDES_DELIVERY_AND_MESSAGE_PERSISTENCE | `createAuthorizedDeliveryAttempt` 先 `DeliveryAttemptAuthorizerPort.authorize`；DENIED/UNAVAILABLE 不创建 attempt；未发明 taxonomy |
| DP-122/125 | SEND_OUTCOME_IS_EXPLICIT_AND_TYPED_NOT_BOOLEAN | `ACKNOWLEDGED / REJECTED / UNKNOWN` + lifecycle `PENDING / IN_FLIGHT`；DB CHECK 强制 |
| DP-124 | MANUAL_AGENT_SEND_AUTHORITY_IS_DISTINCT_FROM_AI_AUTOMATION_LEVEL | automation level 不直接 gate 人工 attempt |
| DP-126 | DELIVERED_MESSAGE_FACT_REQUIRES_AUTHORITATIVE_DELIVERY_OUTCOME | 仅 ACKNOWLEDGED 写 delivered fact（I-35） |
| DP-127 | DELIVERY_ATTEMPT_JOURNAL_IS_DISTINCT_FROM_DELIVERED_MESSAGE_FACT_AND_SYNC_OUTBOX | `delivery_attempts` 表独立于 `normalized_messages`；无 Outbox 字段 |
| DP-128 | UNRESOLVED_IN_FLIGHT_ATTEMPTS_RECOVER_AS_UNKNOWN_NOT_FAILED | `recoverInFlightAttempts`：IN_FLIGHT → UNKNOWN |
| DP-129 | PRODUCTION_SEND_REMAINS_DISABLED_UNTIL_A_REAL_PLATFORM_DELIVERY_ADAPTER_SATISFIES_ACK_CONTRACT | production composition 不绑定 delivery port；Composer Send 仍 disabled |
| DP-130 | ACK FINALIZATION + DELIVERED FACT PERSISTENCE ATOMIC OR RECOVERABLY IDEMPOTENT | `finalizeAcknowledgedDelivery` 单事务写 message fact + attempt ACK/link |
| I-33 | UNKNOWN 不自动 retry、不写 sent fact | `runDeliveryAttempt` UNKNOWN → resolve(UNKNOWN)；无 delivered fact |
| I-34 | ATTEMPT PAYLOAD IMMUTABLE AFTER CREATION | `text_payload` 全文本快照；repo 不更新 payload |
| I-35 | ONLY ACKNOWLEDGED CREATES DELIVERED OUTBOUND FACT | finalize 仅 IN_FLIGHT→ACK |
| I-36 | UNKNOWN REQUIRES RECONCILIATION OR EXPLICIT HUMAN DECISION BEFORE RETRY | retry 非默认；terminal 不可变（I-38 新 attempt） |
| I-37 | ATTEMPT TARGET IMMUTABLE AFTER CREATION | `createAuthorizedDeliveryAttempt` 从已授权 conversation 捕获 store/platform_account |
| I-38 | TERMINAL ATTEMPTS IMMUTABLE; RETRY = NEW ATTEMPT | resolve 后 terminal 不可再转；retry 新 id |
| I-39 | IN_FLIGHT DURABLE BEFORE EXTERNAL DELIVERY SIDE EFFECT | `markInFlight` 先持久化再 `port.deliver` |
| I-40 | ACK FINALIZATION IDEMPOTENT PER ATTEMPT | 已 ACK 再 finalize 为 no-op（无重复 message） |
| I-41 | PAYLOAD NOT IN LOGS/TELEMETRY/ERROR STRINGS BY DEFAULT | 错误消息不含 textPayload（测试断言） |

## 2. 实现（exact files）

- `packages/persistence/migrations/0010_delivery_attempts.sql`（新建，v9→v10）：`delivery_attempts` 表（id/conversation_id/store_id/platform_account_id/text_payload/status(PENDING|IN_FLIGHT|ACKNOWLEDGED|REJECTED|UNKNOWN)/created_at/dispatched_at/resolved_at/delivered_message_id/ack_source_ref/ack_occurred_at）；FK + CHECK + index；无 reconciliation_note/attachment/Outbox 字段；`SUPPORTED_DB_SCHEMA_VERSION=10`。
- `packages/persistence/src/delivery/delivery-attempt.ts`（新建）：`DeliveryAttemptRecord/Status/Outcome/Result`、`SqliteDeliveryAttemptRepository`、`TextDeliveryPort`、`DeliveryAttemptAuthorizerPort`、`createAuthorizedDeliveryAttempt`（I-37/DP-120）、`runDeliveryAttempt`（I-39/I-33/I-35）、`finalizeAcknowledgedDelivery`（DP-130/I-40，单事务）、`recoverInFlightAttempts`（DP-128）、`generateDeliveryAttemptId/generateDeliveryMessageId`。
- `packages/persistence/src/db/errors.ts`：`ERROR_CODES.DELIVERY_ATTEMPT`。
- `apps/desktop/src/main/bootstrap.ts` + `worker-runtime.ts`：`MainContext.deliveryAttempts` port；production 用 `SqliteDeliveryAttemptRepository(m10Sqlite.conn)` 共享 lifecycle（**无第二 DB connection**）；**不绑定 delivery port**（DP-129）。
- v9→v10 传播：persistence/backup/secret-store/desktop 测试 + M12 scripts。

## 3. 验证

- `packages/persistence/tests/delivery-attempt.test.ts`（9 guard）：fresh→v10（表/FK/CHECK）、v9→v10 upgrade（checksum 不变）、authorization-before-attempt（DENIED/UNAVAILABLE 不建 attempt）、I-37 target capture + immutable payload、I-39 IN_FLIGHT durable before driver、ACK 原子 finalize + delivered fact（I-35/I-40 idempotent）、REJECTED/UNKNOWN terminal 无 delivered fact + terminal immutable + retry 新 attempt（I-38）、DP-128 recovery→UNKNOWN、I-41 错误不泄漏 payload。
- `apps/desktop/tests/delivery-attempt-composition.test.ts`（3 guard）：production composition 绑定 Sqlite repo 共享 DB（cross-connection proof）+ 无 delivery port（DP-129）；coordinator 状态机经真实 DB + 受控 test adapters（ACK/REJECT/UNKNOWN + recovery）；I-41 错误不泄漏 payload。
- 回归：persistence 88/88、desktop 298/298、workspace typecheck+test PASS、m6 Electron smoke PASS（external_network_calls=0）、M12 matrix（fresh/v1~v3→v10、v10 no-op、checksum、future-version、reopen）PASS、boundary+secrets PASS。

## 4. 边界（未实现/未改动）

- 未实现 PDD/DouDian driver、retry UI、busy/success/failure UI、attachments（I-32）、Cloud Sync Outbox、**Composer Send enable**（DP-129）。
- `occurred_at` 仅可信 typed source time（未知则 NULL），不用 click/attempt time 冒充；observed_at 由 delivery finalization boundary 产生。
- 未改已 PASS Composer/I-27~I-30；Renderer 不接触 SQLite；未联网；未读 reference/nixiang。
