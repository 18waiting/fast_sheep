// SHEEP-310: BindingValidator 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import { BindingValidator } from "../src/core/binding-validator.ts";

test("所有绑定完整 - 通过", () => {
  const v = new BindingValidator();
  const result = v.validate({
    shopId: "shop-1",
    platformAccountId: "pa-1",
    conversationId: "conv-1",
    triggerMessageId: "msg-1",
    sessionId: "sess-1",
    documentVersion: "v1",
  });
  assert.equal(result.valid, true);
  assert.equal(result.failures.length, 0);
});

test("缺少 shopId - 拒绝", () => {
  const v = new BindingValidator();
  const result = v.validate({
    shopId: "",
    platformAccountId: "pa-1",
    conversationId: "conv-1",
    triggerMessageId: "msg-1",
    sessionId: "sess-1",
    documentVersion: "v1",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.binding === "shop"));
});

test("缺少 platformAccountId - 拒绝", () => {
  const v = new BindingValidator();
  const result = v.validate({
    shopId: "shop-1",
    platformAccountId: "",
    conversationId: "conv-1",
    triggerMessageId: "msg-1",
    sessionId: "sess-1",
    documentVersion: "v1",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.binding === "platform"));
});

test("缺少 conversationId - 拒绝", () => {
  const v = new BindingValidator();
  const result = v.validate({
    shopId: "shop-1",
    platformAccountId: "pa-1",
    conversationId: "",
    triggerMessageId: "msg-1",
    sessionId: "sess-1",
    documentVersion: "v1",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.binding === "conversation"));
});

test("缺少 triggerMessageId - 拒绝", () => {
  const v = new BindingValidator();
  const result = v.validate({
    shopId: "shop-1",
    platformAccountId: "pa-1",
    conversationId: "conv-1",
    triggerMessageId: "",
    sessionId: "sess-1",
    documentVersion: "v1",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.binding === "trigger"));
});

test("缺少 sessionId - 拒绝", () => {
  const v = new BindingValidator();
  const result = v.validate({
    shopId: "shop-1",
    platformAccountId: "pa-1",
    conversationId: "conv-1",
    triggerMessageId: "msg-1",
    sessionId: "",
    documentVersion: "v1",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.binding === "session"));
});

test("缺少 documentVersion - 拒绝", () => {
  const v = new BindingValidator();
  const result = v.validate({
    shopId: "shop-1",
    platformAccountId: "pa-1",
    conversationId: "conv-1",
    triggerMessageId: "msg-1",
    sessionId: "sess-1",
    documentVersion: "",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.binding === "document"));
});

test("多个绑定缺失 - 全部报告", () => {
  const v = new BindingValidator();
  const result = v.validate({
    shopId: "",
    platformAccountId: "",
    conversationId: "conv-1",
    triggerMessageId: "msg-1",
    sessionId: "sess-1",
    documentVersion: "v1",
  });
  assert.equal(result.valid, false);
  assert.equal(result.failures.length, 2);
  assert.ok(result.failures.some(f => f.binding === "shop"));
  assert.ok(result.failures.some(f => f.binding === "platform"));
});

test("所有绑定缺失 - 报告 6 个失败", () => {
  const v = new BindingValidator();
  const result = v.validate({
    shopId: "",
    platformAccountId: "",
    conversationId: "",
    triggerMessageId: "",
    sessionId: "",
    documentVersion: "",
  });
  assert.equal(result.valid, false);
  assert.equal(result.failures.length, 6);
});

test("空白字符串 - 视为缺失", () => {
  const v = new BindingValidator();
  const result = v.validate({
    shopId: "   ",
    platformAccountId: "pa-1",
    conversationId: "conv-1",
    triggerMessageId: "msg-1",
    sessionId: "sess-1",
    documentVersion: "v1",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.binding === "shop"));
});
