// SHEEP-311: ConversationOrchestrator HumanConfirm 集成测试
import { test } from "node:test";
import assert from "node:assert/strict";
import { ConversationOrchestrator } from "../src/core/conversation-orchestrator.ts";
import { HumanConfirmController } from "../src/core/human-confirm-controller.ts";
import type { IdentityLock, ReplyPlanRef, PolicyDecisionRef } from "../src/core/human-confirm-controller.ts";
import type { AiEngineClient } from "../src/ports/ai-engine-client.ts";
import type { PlatformAdapter } from "../src/ports/platform-adapter.ts";
import type { Clock } from "../src/ports/clock.ts";
import type { EventBus } from "../src/ports/event-bus.ts";
import type { FeedbackSink } from "../src/ports/feedback-sink.ts";
import type { ConversationRepositoryPort } from "../src/ports/conversation-repository-port.ts";

// Mock IdentityLock
const mockIdentityLock: IdentityLock = {
  merchant_id: "merchant-1",
  store_id: "store-1",
  platform: "pdd",
  platform_account_id: "account-1",
  conversation_id: "conv-1",
  trigger_message_id: "msg-1",
};

// Mock ReplyPlanRef
const mockPlan: ReplyPlanRef = {
  plan_id: "plan-123",
  identity_lock: mockIdentityLock,
};

// Mock PolicyDecisionRef
const mockHumanConfirmDecision: PolicyDecisionRef = {
  rollout_mode: "HUMAN_CONFIRM",
  requires_confirmation: true,
  policy_version: "1.0.0",
};

// Mock dependencies
const mockAiEngine: AiEngineClient = {
  generate: async () => ({ text: "", finish_reason: "stop" }),
};

const mockPlatform: PlatformAdapter = {
  sendText: async () => ({ ok: true }),
  getConversation: async () => ({ messages: [] }),
};

const mockClock: Clock = () => "2026-09-30T10:00:00.000Z";

const mockEventBus: EventBus = {
  emit: () => {},
  on: () => () => {},
};

const mockFeedbackSink: FeedbackSink = {
  record: () => {},
};

const mockRepository: ConversationRepositoryPort = {
  appendTurn: async () => {},
  getTurns: async () => [],
};

function createOrchestrator(withHumanConfirm: boolean = true): ConversationOrchestrator {
  const options = {
    aiEngineClient: mockAiEngine,
    platformAdapter: mockPlatform,
    clock: mockClock,
    eventBus: mockEventBus,
    feedbackSink: mockFeedbackSink,
    repository: mockRepository,
  };

  if (withHumanConfirm) {
    return new ConversationOrchestrator({
      ...options,
      humanConfirmController: new HumanConfirmController({ clock: mockClock }),
    });
  }

  return new ConversationOrchestrator(options);
}

test("isHumanConfirmationEnabled - 配置了 HumanConfirmController", () => {
  const orchestrator = createOrchestrator(true);
  assert.equal(orchestrator.isHumanConfirmationEnabled(), true);
});

test("isHumanConfirmationEnabled - 未配置 HumanConfirmController", () => {
  const orchestrator = createOrchestrator(false);
  assert.equal(orchestrator.isHumanConfirmationEnabled(), false);
});

test("requestHumanConfirmation - 创建确认请求", () => {
  const orchestrator = createOrchestrator(true);
  const request = orchestrator.requestHumanConfirmation(mockPlan, mockHumanConfirmDecision);

  assert.ok(request);
  assert.ok(request!.confirmation_id.startsWith("conf-"));
  assert.equal(request!.plan_id, "plan-123");
  assert.equal(request!.status, "PENDING");
});

test("requestHumanConfirmation - 未配置时返回 null", () => {
  const orchestrator = createOrchestrator(false);
  const request = orchestrator.requestHumanConfirmation(mockPlan, mockHumanConfirmDecision);

  assert.equal(request, null);
});

test("requestHumanConfirmation - AUTO 模式抛出异常", () => {
  const orchestrator = createOrchestrator(true);
  const autoDecision: PolicyDecisionRef = {
    rollout_mode: "AUTO",
    requires_confirmation: false,
    policy_version: "1.0.0",
  };

  assert.throws(
    () => orchestrator.requestHumanConfirmation(mockPlan, autoDecision),
    /AUTO mode is explicitly rejected/
  );
});

test("confirmHumanAction - 成功确认", () => {
  const orchestrator = createOrchestrator(true);
  const request = orchestrator.requestHumanConfirmation(mockPlan, mockHumanConfirmDecision);

  const result = orchestrator.confirmHumanAction(request!.confirmation_id, "user-123");

  assert.equal(result.success, true);
  assert.ok(result.confirmation);
  assert.equal(result.confirmation!.plan_id, "plan-123");
});

test("confirmHumanAction - 未配置时返回失败", () => {
  const orchestrator = createOrchestrator(false);
  const result = orchestrator.confirmHumanAction("conf-123", "user-123");

  assert.equal(result.success, false);
  assert.match(result.reason!, /not configured/);
});

test("rejectHumanAction - 成功拒绝", () => {
  const orchestrator = createOrchestrator(true);
  const request = orchestrator.requestHumanConfirmation(mockPlan, mockHumanConfirmDecision);

  const result = orchestrator.rejectHumanAction(
    request!.confirmation_id,
    "user-123",
    "Content needs revision"
  );

  assert.equal(result.success, true);
  assert.equal(result.request!.status, "REJECTED");
});

test("getHumanConfirmationStatus - 查询状态", () => {
  const orchestrator = createOrchestrator(true);
  const request = orchestrator.requestHumanConfirmation(mockPlan, mockHumanConfirmDecision);

  assert.equal(
    orchestrator.getHumanConfirmationStatus(request!.confirmation_id),
    "PENDING"
  );

  orchestrator.confirmHumanAction(request!.confirmation_id, "user-123");

  assert.equal(
    orchestrator.getHumanConfirmationStatus(request!.confirmation_id),
    "CONFIRMED"
  );
});

test("getHumanConfirmationStatus - 未配置时返回 NOT_CONFIGURED", () => {
  const orchestrator = createOrchestrator(false);
  assert.equal(orchestrator.getHumanConfirmationStatus("conf-123"), "NOT_CONFIGURED");
});

test("完整流程 - 请求、确认、验证", () => {
  const orchestrator = createOrchestrator(true);

  // 1. 请求确认
  const request = orchestrator.requestHumanConfirmation(mockPlan, mockHumanConfirmDecision);
  assert.ok(request);
  assert.equal(request.status, "PENDING");

  // 2. 人类确认
  const result = orchestrator.confirmHumanAction(request.confirmation_id, "user-123");
  assert.equal(result.success, true);

  // 3. 查询状态
  assert.equal(
    orchestrator.getHumanConfirmationStatus(request.confirmation_id),
    "CONFIRMED"
  );

  // 4. 验证确认
  const isValid = orchestrator.validateHumanConfirmation(
    request.confirmation_id,
    mockPlan.plan_id,
    mockPlan.identity_lock
  );
  assert.equal(isValid, true);
});

test("完整流程 - 请求、拒绝", () => {
  const orchestrator = createOrchestrator(true);

  // 1. 请求确认
  const request = orchestrator.requestHumanConfirmation(mockPlan, mockHumanConfirmDecision);

  // 2. 人类拒绝
  const result = orchestrator.rejectHumanAction(
    request!.confirmation_id,
    "user-123",
    "Incorrect reply"
  );
  assert.equal(result.success, true);

  // 3. 查询状态
  assert.equal(
    orchestrator.getHumanConfirmationStatus(request!.confirmation_id),
    "REJECTED"
  );
});
