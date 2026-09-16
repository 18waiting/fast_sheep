import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateProjectState } from "../scripts/validate-project-state.mjs";

const root = resolve(import.meta.dirname, "..");
const actualState = JSON.parse(readFileSync(resolve(root, "project", "PROJECT_STATE.json"), "utf8"));
const roadmapPath = actualState.state_authority.roadmap_identity_source;
const roadmapText = readFileSync(resolve(root, roadmapPath), "utf8");

function codes(errors) {
  return errors.map((error) => error.code);
}

function cloneState() {
  return structuredClone(actualState);
}

test("actual PROJECT_STATE satisfies canonical authority and consistency", () => {
  assert.ok(actualState.state_authority.roadmap_identity_source.includes("V1.1_REVIEWED"));
  assert.ok(actualState.task_template.reviewed_path.includes("V1.1_REVIEWED"));
  assert.equal(actualState.sheep_301, undefined);
  assert.equal(actualState.sheep_091.historical_classification, "DEFERRED_HISTORICAL_V1_0");
  assert.equal(actualState.sheep_300.execution_authorized, false);
  assert.deepEqual(validateProjectState(actualState, { roadmapText }), []);
});

test("historical deferred V1.0 task IDs are not treated as current or later execution", () => {
  const state = cloneState();
  state.sheep_091.status = "IMPLEMENTED";
  state.sheep_091.execution_authorized = true;
  assert.deepEqual(validateProjectState(state, { roadmapText }), []);
});

test("lifecycle_stage must agree with canonical current_phase", () => {
  const state = cloneState();
  state.lifecycle_stage = "PHASE_999";
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("LIFECYCLE_STAGE_PHASE_MISMATCH"));
});

test("current task phase projection must agree with canonical current_phase", () => {
  const state = cloneState();
  state.sheep_300.phase = "PHASE_999";
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("CURRENT_TASK_PHASE_MISMATCH"));
});

test("current task milestone projection must agree with canonical current_milestone", () => {
  const state = cloneState();
  state.sheep_300.milestone = "M9.9 Wrong";
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("CURRENT_TASK_MILESTONE_MISMATCH"));
});

test("current task next_stage_not_executed projection must agree with canonical gate", () => {
  const state = cloneState();
  state.sheep_300.next_stage_not_executed = false;
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("CURRENT_TASK_NEXT_STAGE_PROJECTION_MISMATCH"));
});

test("task identity mismatch is rejected", () => {
  const state = cloneState();
  state.current_task = state.current_task.replace(state.next_authoritative_roadmap_id, "SHEEP-999");
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("PROJECTION_TASK_ID_MISMATCH"));
});

test("top-level false with current task execution true is rejected", () => {
  const state = cloneState();
  state.next_task_execution_authorized = false;
  state.current_execution_authorization = false;
  state.sheep_300.execution_authorized = true;
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("CURRENT_TASK_EXECUTION_GATE_MISMATCH"));
});

test("paused current task with active live evidence is rejected", () => {
  const state = cloneState();
  state.sheep_300.evidence_acquisition_authorization = "AUTHORIZED WITH CONSTRAINTS";
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("PAUSED_TASK_WITH_LIVE_EVIDENCE"));
});

test("historical authorization does not become current authorization", () => {
  const state = cloneState();
  state.sheep_091.historical_authorization.execution_authorized = true;
  state.sheep_091.execution_authorized = false;
  state.next_task_execution_authorized = false;
  state.current_execution_authorization = false;
  assert.deepEqual(validateProjectState(state, { roadmapText }), []);
});

test("closure contradiction and later-task authorization are rejected", () => {
  const state = cloneState();
  state.sheep_090.controller_decision = "REPAIR";
  state.sheep_301 = { execution_authorized: true };
  const result = codes(validateProjectState(state, { roadmapText }));
  assert.ok(result.includes("LAST_CLOSED_TASK_CONTRADICTS_CLOSURE"));
  assert.ok(result.includes("LATER_TASK_AUTHORIZED_WHILE_STAGE_NOT_EXECUTED"));
});

test("last-closed task status and roadmap_status cannot contradict closure", () => {
  const state = cloneState();
  state.sheep_090.roadmap_status = "NOT_STARTED";
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("LAST_CLOSED_TASK_CONTRADICTS_CLOSURE"));
});

test("later task executed lifecycle is rejected without an authorization boolean", () => {
  const state = cloneState();
  state.sheep_301 = { status: "IMPLEMENTED" };
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED"));
});

test("later-task governance-only lifecycle tokens do not prove execution", () => {
  for (const status of ["BLOCKED", "CANCELLED", "SKIPPED", "AWAITING"]) {
    const state = cloneState();
    state.sheep_301 = { status };
    assert.ok(!codes(validateProjectState(state, { roadmapText })).includes("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED"), status);
  }
});

test("independent later-task execution evidence still fails with a governance token", () => {
  const blocked = cloneState();
  blocked.sheep_301 = { status: "BLOCKED", implementation_result: "IMPLEMENTED" };
  assert.ok(codes(validateProjectState(blocked, { roadmapText })).includes("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED"));

  const cancelled = cloneState();
  cancelled.sheep_301 = { status: "CANCELLED", execution_result: "EXECUTED" };
  assert.ok(codes(validateProjectState(cancelled, { roadmapText })).includes("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED"));
});

test("later-task execution and advancement indicators remain rejected", () => {
  for (const status of ["IMPLEMENTED", "PASS", "CLOSED", "EXECUTED", "IN_PROGRESS", "COMPLETE", "ACCEPTED", "FAIL", "FAILED", "PARTIAL", "REPAIR"]) {
    const state = cloneState();
    state.sheep_301 = { status };
    assert.ok(codes(validateProjectState(state, { roadmapText })).includes("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED"), status);
  }
});

test("historical closed task shape differences do not fail validation", () => {
  const state = cloneState();
  delete state.sheep_089.roadmap_status;
  delete state.sheep_089.controller_decision;
  assert.deepEqual(validateProjectState(state, { roadmapText }), []);
});
