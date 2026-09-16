import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateProjectState } from "../scripts/validate-project-state.mjs";

const root = resolve(import.meta.dirname, "..");
const actualState = JSON.parse(readFileSync(resolve(root, "project", "PROJECT_STATE.json"), "utf8"));
const roadmapPath = actualState.state_authority.roadmap_identity_source;
const roadmapText = readFileSync(resolve(root, roadmapPath), "utf8");
const nextTaskId = actualState.next_authoritative_roadmap_id;
const nextTaskKey = taskKey(nextTaskId);

function codes(errors) {
  return errors.map((error) => error.code);
}

function taskKey(taskId) {
  return String(taskId).toLowerCase().replace("-", "_");
}

function taskNumber(taskId) {
  const match = /^SHEEP-(\d{3})$/.exec(String(taskId));
  return match ? Number(match[1]) : null;
}

function laterTaskId(taskId, offset = 1) {
  const number = taskNumber(taskId);
  if (number === null) throw new Error("invalid task id: " + taskId);
  return "SHEEP-" + String(number + offset).padStart(3, "0");
}

function cloneState() {
  return structuredClone(actualState);
}

function ensureCurrentTask(state) {
  const key = taskKey(state.next_authoritative_roadmap_id);
  if (!state[key]) {
    state[key] = {
      phase: state.current_phase,
      milestone: state.current_milestone,
      next_stage_not_executed: state.next_stage_not_executed,
      execution_authorized: state.next_task_execution_authorized,
      current_execution_authorization: state.current_execution_authorization,
      current_live_evidence_authorization: state.current_live_evidence_authorization,
    };
  }
  return state[key];
}

test("actual PROJECT_STATE closes SHEEP-300 and advances to unauthorized SHEEP-301", () => {
  assert.ok(actualState.state_authority.roadmap_identity_source.includes("V1.1_REVIEWED"));
  assert.ok(actualState.task_template.reviewed_path.includes("V1.1_REVIEWED"));
  assert.equal(actualState.last_closed_task, "SHEEP-300");
  assert.equal(actualState.sheep_300.status, "PASS / CLOSED");
  assert.equal(actualState.sheep_300.implementation_commit, "40b92d5d0f53f4a226b88e27d071f1a1fb82b593");
  assert.equal(actualState.next_authoritative_roadmap_id, "SHEEP-301");
  assert.ok(actualState.current_task.startsWith("SHEEP-301"));
  assert.ok(actualState.next_task.startsWith("SHEEP-301"));
  assert.equal(actualState.next_task_execution_authorized, false);
  assert.equal(actualState.current_execution_authorization, false);
  assert.equal(actualState.next_stage_not_executed, true);
  assert.equal(actualState.sheep_091.historical_classification, "DEFERRED_HISTORICAL_V1_0");
  assert.deepEqual(validateProjectState(actualState, { roadmapText }), []);
});

test("current task identity is derived from the canonical next task pointer", () => {
  assert.equal(taskKey(actualState.next_authoritative_roadmap_id), nextTaskKey);
  assert.ok(actualState.current_task.startsWith(nextTaskId));
  assert.ok(actualState.next_task.startsWith(nextTaskId));
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
  ensureCurrentTask(state).phase = "PHASE_999";
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("CURRENT_TASK_PHASE_MISMATCH"));
});

test("current task milestone projection must agree with canonical current_milestone", () => {
  const state = cloneState();
  ensureCurrentTask(state).milestone = "M9.9 Wrong";
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("CURRENT_TASK_MILESTONE_MISMATCH"));
});

test("current task next_stage_not_executed projection must agree with canonical gate", () => {
  const state = cloneState();
  ensureCurrentTask(state).next_stage_not_executed = false;
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("CURRENT_TASK_NEXT_STAGE_PROJECTION_MISMATCH"));
});

test("task identity mismatch is rejected", () => {
  const state = cloneState();
  state.current_task = state.current_task.replace(state.next_authoritative_roadmap_id, "SHEEP-999");
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("PROJECTION_TASK_ID_MISMATCH"));
});

test("top-level false with current task execution true is rejected", () => {
  const state = cloneState();
  ensureCurrentTask(state).execution_authorized = true;
  state.next_task_execution_authorized = false;
  state.current_execution_authorization = false;
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("CURRENT_TASK_EXECUTION_GATE_MISMATCH"));
});

test("paused current task with active live evidence is rejected", () => {
  const state = cloneState();
  ensureCurrentTask(state).evidence_acquisition_authorization = "AUTHORIZED WITH CONSTRAINTS";
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
  state[taskKey(state.last_closed_task)].controller_decision = "REPAIR";
  state[taskKey(laterTaskId(state.next_authoritative_roadmap_id))] = { execution_authorized: true };
  const result = codes(validateProjectState(state, { roadmapText }));
  assert.ok(result.includes("LAST_CLOSED_TASK_CONTRADICTS_CLOSURE"));
  assert.ok(result.includes("LATER_TASK_AUTHORIZED_WHILE_STAGE_NOT_EXECUTED"));
});

test("last-closed task status and roadmap_status cannot contradict closure", () => {
  const state = cloneState();
  state[taskKey(state.last_closed_task)].roadmap_status = "NOT_STARTED";
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("LAST_CLOSED_TASK_CONTRADICTS_CLOSURE"));
});

test("later task executed lifecycle is rejected without an authorization boolean", () => {
  const state = cloneState();
  state[taskKey(laterTaskId(state.next_authoritative_roadmap_id))] = { status: "IMPLEMENTED" };
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED"));
});

test("later-task governance-only lifecycle tokens do not prove execution", () => {
  for (const status of ["BLOCKED", "CANCELLED", "SKIPPED", "AWAITING"]) {
    const state = cloneState();
    state[taskKey(laterTaskId(state.next_authoritative_roadmap_id))] = { status };
    assert.ok(!codes(validateProjectState(state, { roadmapText })).includes("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED"), status);
  }
});

test("independent later-task execution evidence still fails with a governance token", () => {
  const blocked = cloneState();
  blocked[taskKey(laterTaskId(blocked.next_authoritative_roadmap_id))] = { status: "BLOCKED", implementation_result: "IMPLEMENTED" };
  assert.ok(codes(validateProjectState(blocked, { roadmapText })).includes("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED"));

  const cancelled = cloneState();
  cancelled[taskKey(laterTaskId(cancelled.next_authoritative_roadmap_id))] = { status: "CANCELLED", execution_result: "EXECUTED" };
  assert.ok(codes(validateProjectState(cancelled, { roadmapText })).includes("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED"));
});

test("later-task execution and advancement indicators remain rejected", () => {
  for (const status of ["IMPLEMENTED", "PASS", "CLOSED", "EXECUTED", "IN_PROGRESS", "COMPLETE", "ACCEPTED", "FAIL", "FAILED", "PARTIAL", "REPAIR"]) {
    const state = cloneState();
    state[taskKey(laterTaskId(state.next_authoritative_roadmap_id))] = { status };
    assert.ok(codes(validateProjectState(state, { roadmapText })).includes("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED"), status);
  }
});

test("historical closed task shape differences do not fail validation", () => {
  const state = cloneState();
  delete state.sheep_089.roadmap_status;
  delete state.sheep_089.controller_decision;
  assert.deepEqual(validateProjectState(state, { roadmapText }), []);
});
