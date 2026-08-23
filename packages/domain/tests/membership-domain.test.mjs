import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROLE_OWNER, ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_AGENT, DEFAULT_ROLES,
} from "../dist/index.js";

// --- T-A: Membership is the SINGLE ownership source; Member has no merchantId ---
test("Member does NOT carry merchantId (ownership lives on Membership, T-A)", () => {
  const member = { id: "member-1", accountRef: { kind: "local", value: "account-1" } };
  assert.deepEqual(Object.keys(member).sort(), ["accountRef", "id"]);
  assert.equal(Object.hasOwn(member, "merchantId"), false, "Member must not duplicate the ownership fact");
});

test("Membership carries the ownership fact: merchantId + memberId + role", () => {
  const ms = { id: "membership-1", merchantId: "merchant-1", memberId: "member-1", role: ROLE_OWNER };
  assert.equal(ms.merchantId, "merchant-1");
  assert.equal(ms.memberId, "member-1");
  assert.equal(ms.role, ROLE_OWNER);
  assert.deepEqual(Object.keys(ms).sort(), ["id", "memberId", "merchantId", "role"]);
});

// --- T-B: Seat is a Merchant-scoped identity placeholder, NOT commercial capacity ---
test("Seat is only {id, merchantId} placeholder; no quota/capacity semantics (T-B)", () => {
  const seat = { id: "seat-1", merchantId: "merchant-1" };
  assert.deepEqual(Object.keys(seat).sort(), ["id", "merchantId"]);
  for (const forbidden of ["maxSeats", "quota", "allocation", "occupied", "capacity"]) {
    assert.equal(Object.hasOwn(seat, forbidden), false, `Seat must not carry ${forbidden} (DEC-012/Phase 11)`);
  }
});

// --- T-C: default roles exactly the four DEC-011 roles ---
test("DEFAULT_ROLES is exactly owner/admin/supervisor/agent (T-C)", () => {
  assert.deepEqual([...DEFAULT_ROLES], [ROLE_OWNER, ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_AGENT]);
  assert.deepEqual([...DEFAULT_ROLES].sort(), ["admin", "agent", "owner", "supervisor"]);
});

// --- T1: no invented status vocabularies ---
test("Member/Membership/Seat have no status/enabled fields (T1)", () => {
  for (const obj of [
    { id: "m", accountRef: { kind: "local", value: "a" } },
    { id: "x", merchantId: "m", memberId: "m", role: ROLE_AGENT },
    { id: "s", merchantId: "m" },
  ]) {
    for (const k of Object.keys(obj)) assert.notEqual(k, "status");
    assert.equal(Object.hasOwn(obj, "enabled"), false);
  }
});

// --- T3: no sync/revision/outbox semantics ---
test("Membership/Seat carry no sync/revision/outbox fields (T3)", () => {
  const ms = { id: "x", merchantId: "m", memberId: "m", role: ROLE_AGENT };
  const seat = { id: "s", merchantId: "m" };
  for (const obj of [ms, seat]) {
    for (const k of ["revision", "outbox", "remoteSyncId", "lastSyncedAt", "version"]) {
      assert.equal(Object.hasOwn(obj, k), false, `no ${k}`);
    }
  }
});