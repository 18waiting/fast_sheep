import { test } from "node:test";
import assert from "node:assert/strict";

import { validateSetModeRequest, validateManualSendRequest, validateNoSaveSendRequest, validateCancelRequest, validateFocusRequest, validateJobGetRequest, validateJobCancelRequest, validateReviewActionRequest, validateAuditActionRequest, validateOptimizationActionRequest } from "../dist/index.js";

test("valid request schemas pass", () => {
  assert.ok(validateSetModeRequest({ shop_id: "s1", mode: "full_auto" }).ok);
  assert.ok(validateManualSendRequest({ shop_id: "s1", conversation_id: "c1" }).ok);
  assert.ok(validateNoSaveSendRequest({ shop_id: "s1", conversation_id: "c1" }).ok);
  assert.ok(validateCancelRequest({ shop_id: "s1", conversation_id: "c1" }).ok);
  assert.ok(validateFocusRequest({ shop_id: "s1" }).ok);
  assert.ok(validateJobGetRequest({ job_id: "j1" }).ok);
  assert.ok(validateJobCancelRequest({ job_id: "j1" }).ok);
  assert.ok(validateReviewActionRequest({ action: "propose" }).ok);
  assert.ok(validateAuditActionRequest({ action: "保留" }).ok);
  assert.ok(validateOptimizationActionRequest({ action: "apply" }).ok);
});

test("invalid requests fail", () => {
  assert.ok(!validateSetModeRequest({ shop_id: "s1", mode: "weird" }).ok);
  assert.ok(!validateManualSendRequest({ shop_id: "s1" }).ok);
  assert.ok(!validateFocusRequest({}).ok);
  assert.ok(!validateJobGetRequest({}).ok);
  assert.ok(!validateReviewActionRequest({ action: "nope" }).ok);
  assert.ok(!validateAuditActionRequest({ action: "保留x" }).ok);
  assert.ok(!validateOptimizationActionRequest({ action: "nope" }).ok);
});
