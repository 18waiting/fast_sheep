// SHEEP-310: WrongTargetValidator 单元测试
import { test } from "node:test";
import assert from "node:assert/strict";
import { WrongTargetValidator } from "../src/core/wrong-target-validator.ts";

test("有效上下文 - 通过验证", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({ shopId: "shop-1", conversationId: "conv-1" });
  assert.equal(result.valid, true);
  assert.equal(result.failures.length, 0);
});

test("空 shopId - 拒绝", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({ shopId: "", conversationId: "conv-1" });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.field === "shopId"));
});

test("空 conversationId - 拒绝", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({ shopId: "shop-1", conversationId: "" });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.field === "conversationId"));
});

test("跨店铺执行 - 拒绝", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "shop-2",
    conversationId: "conv-1",
    expectedShopId: "shop-1",
  });
  assert.equal(result.valid, false);
  const failure = result.failures.find(f => f.field === "shopId" && f.reason.includes("cross-shop"));
  assert.ok(failure);
  assert.equal(failure.expected, "shop-1");
  assert.equal(failure.actual, "shop-2");
});

test("customerUid 不匹配 - 独立于 conversationId 拒绝", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    customerUid: "buyer-wrong",
    expectedCustomerUid: "buyer-correct",
  });
  assert.equal(result.valid, false);
  const failure = result.failures.find(f => f.field === "customerUid");
  assert.ok(failure);
  assert.equal(failure.expected, "buyer-correct");
  assert.equal(failure.actual, "buyer-wrong");
});

test("customerUid 匹配 - 通过", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    customerUid: "buyer-1",
    expectedCustomerUid: "buyer-1",
  });
  assert.equal(result.valid, true);
});

test("空 customerUid（提供了但为空） - 拒绝", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    customerUid: "  ",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.field === "customerUid"));
});

test("空 platformAccountId - 拒绝", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    platformAccountId: "",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.field === "platformAccountId"));
});

test("空 triggerMessageId - 拒绝（stale selection）", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    triggerMessageId: "",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.field === "triggerMessageId" && f.reason.includes("stale")));
});

test("空 sessionId - 拒绝", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    sessionId: "",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.field === "sessionId"));
});

test("documentVersion 不匹配 - 拒绝（stale reference）", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    documentVersion: "v1",
    expectedDocumentVersion: "v2",
  });
  assert.equal(result.valid, false);
  const failure = result.failures.find(f => f.field === "documentVersion");
  assert.ok(failure);
  assert.equal(failure.expected, "v2");
  assert.equal(failure.actual, "v1");
});

test("documentVersion 匹配 - 通过", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    documentVersion: "v2",
    expectedDocumentVersion: "v2",
  });
  assert.equal(result.valid, true);
});

test("多个失败 - 全部报告", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "",
    conversationId: "",
    customerUid: "  ",
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.length >= 3);
});

test("可选字段未提供 - 跳过验证", () => {
  const v = new WrongTargetValidator();
  const result = v.validate({
    shopId: "shop-1",
    conversationId: "conv-1",
    // customerUid, platformAccountId, etc. 不提供
  });
  assert.equal(result.valid, true);
});
