import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePddOrderCsGroupConvListPayload } from "../dist/main/platforms/pdd/pdd-inbound-transport.js";

// Shape observed in the first real PDD capture: result.data[].lastMessage carried the same
// customer message that latest_conversations carried. Values are synthetic.
const CUSTOMER = {
  success: true, errorCode: 1000000, errorMsg: null,
  result: { total: 1, data: [ {
    lastMessage: { is_read: null, last_unreply_time: 1700000999, from: { uid: "800000001", role: "user" }, to: { uid: "900000001", role: "mall_cs" }, msg_id: "1700001000001", type: 0, content: "在吗", ts: "1700001000" },
    userInfo: { uid: 800000001, convUid: "800000001", nickname: "示***例", gender: 1, regularCustomer: false, groupNumber: 0, isShopMember: false },
  } ] },
};
const AGENT = {
  success: true,
  result: { total: 1, data: [ { lastMessage: { from: { uid: "900000001", role: "mall_cs" }, to: { uid: "800000001", role: "user" }, msg_id: "1700001000002", content: "在的", ts: "1700001001" }, userInfo: { uid: 800000001, nickname: "示***例" } } ] },
};

test("orderCsGroupConvList customer record decodes to canonical ingress input", () => {
  const d = decodePddOrderCsGroupConvListPayload(CUSTOMER);
  assert.equal(d.status, "DECODED");
  assert.equal(d.messages.length, 1);
  assert.equal(d.messages[0].classification, "CUSTOMER_INBOUND");
  const i = d.messages[0].ingressInput;
  assert.equal(i.payload.from.role, "user");
  assert.equal(i.payload.from.uid, "800000001");
  assert.equal(i.payload.to.role, "mall_cs");
  assert.equal(i.payload.content, "在吗");
  assert.equal(i.payload.msg_id, "1700001000001");
  assert.equal(i.sourceOccurredAt, "1700001000");
});

test("orderCsGroupConvList agent record is not inbound and unsupported shapes exit explicitly", () => {
  const a = decodePddOrderCsGroupConvListPayload(AGENT);
  assert.equal(a.status, "DECODED");
  assert.equal(a.messages[0].classification, "NOT_CUSTOMER_ORIGINATED");
  assert.equal(a.messages[0].ingressInput, undefined);
  for (const bad of ["{bad", "[]", null, { success: true }, { success: true, result: {} }]) {
    assert.equal(decodePddOrderCsGroupConvListPayload(bad).status, "UNSUPPORTED");
  }
});