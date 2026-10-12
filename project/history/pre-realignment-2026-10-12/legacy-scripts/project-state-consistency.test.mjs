import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { taskRecordFor, validateProjectState } from "../scripts/validate-project-state.mjs";

const root = resolve(import.meta.dirname, "..");
const actualState = JSON.parse(readFileSync(resolve(root, "project", "PROJECT_STATE.json"), "utf8"));
const roadmapPath = actualState.state_authority.roadmap_identity_source;
const roadmapText = readFileSync(resolve(root, roadmapPath.replaceAll("\\", "/")), "utf8");
const nextTaskId = actualState.next_authoritative_roadmap_id;
const nextTaskKey = taskKey(nextTaskId);

function codes(errors) {
  return errors.map((error) => error.code);
}

function taskKey(taskId) {
  return String(taskId).toLowerCase().replace("-", "_");
}
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ensureTaskRecord(state, taskId) {
  const key = taskKey(taskId);
  if (!isObject(state[key])) state[key] = {};
  return state[key];
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
  const task = ensureTaskRecord(state, state.next_authoritative_roadmap_id);
  if (!Object.hasOwn(task, "phase")) task.phase = state.current_phase;
  if (!Object.hasOwn(task, "milestone")) task.milestone = state.current_milestone;
  if (!Object.hasOwn(task, "next_stage_not_executed")) task.next_stage_not_executed = state.next_stage_not_executed;
  if (!Object.hasOwn(task, "execution_authorized")) task.execution_authorized = state.next_task_execution_authorized;
  if (!Object.hasOwn(task, "current_execution_authorization")) task.current_execution_authorization = state.current_execution_authorization;
  if (!Object.hasOwn(task, "current_live_evidence_authorization")) task.current_live_evidence_authorization = state.current_live_evidence_authorization;
  return task;
}

test("actual PROJECT_STATE advances to the next unauthorized Roadmap task", () => {
  assert.ok(actualState.state_authority.roadmap_identity_source.includes("V1.1_REVIEWED"));
  assert.ok(actualState.task_template.reviewed_path.includes("V1.1_REVIEWED"));
  const taskIds = [...roadmapText.matchAll(/^###\s+(SHEEP-\d{3})\b/gm)].map((match) => match[1]);
  const closedIndex = taskIds.indexOf(actualState.last_closed_task);
  assert.ok(closedIndex >= 0);
  assert.equal(actualState.next_authoritative_roadmap_id, taskIds[closedIndex + 1]);
  assert.equal(taskRecordFor(actualState, actualState.last_closed_task).controller_decision, "PASS");
  assert.ok(actualState.current_task.startsWith(nextTaskId));
  assert.ok(actualState.next_task.startsWith(nextTaskId));
  assert.equal(actualState.current_phase, "MVP_E_MULTI_SHOP_EXPANSION");
  assert.equal(actualState.current_milestone, "MVP-E MULTI_SHOP_EXPANSION");
  assert.equal(actualState.current_milestone_state, "PLANNED / NOT_AUTHORIZED");
  assert.equal(actualState.last_completed_milestone, "MVP-D AUTO");
  assert.equal(actualState.next_action.task_id, nextTaskId);
  assert.equal(actualState.next_action.authorized, false);
  assert.equal(actualState.next_task_execution_authorized, false);
  assert.equal(actualState.current_execution_authorization, false);
  assert.equal(actualState.next_stage_not_executed, true);
  assert.equal(actualState.sheep_091.historical_classification, "DEFERRED_HISTORICAL_V1_0");
  assert.deepEqual(validateProjectState(actualState, { roadmapText }), []);
});

test("subordinate remediation program cannot override the canonical task", () => {
  const state = cloneState();
  state.remediation_program.canonical_task_override = true;
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("REMEDIATION_PROGRAM_CANNOT_OVERRIDE_CANONICAL_TASK"));
});

test("subordinate remediation program cannot grant execution lanes", () => {
  const state = cloneState();
  state.remediation_program.execution_lanes.code_implementation = "AUTHORIZED";
  state.remediation_program.execution_lanes.real_send = "AUTHORIZED";
  state.remediation_program.execution_lanes.auto = "AUTHORIZED";
  state.remediation_program.execution_lanes.production_enablement = "AUTHORIZED";
  const result = codes(validateProjectState(state, { roadmapText }));
  assert.ok(result.includes("REMEDIATION_CODE_AUTHORIZED_WHILE_CANONICAL_PAUSED"));
  assert.ok(result.includes("REMEDIATION_REAL_SEND_AUTHORIZED_WHILE_LIVE_PAUSED"));
  assert.ok(result.includes("REMEDIATION_AUTO_AUTHORIZED"));
  assert.ok(result.includes("REMEDIATION_PRODUCTION_AUTHORIZED"));
});
test("structured next_action must identify the canonical next task", () => {
  const state = cloneState();
  state.next_action = { task_id: "SHEEP-999", action: "REVIEW", authorized: false };
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("PROJECTION_TASK_ID_MISMATCH"));
});

test("a completed task without Controller PASS cannot be last closed", () => {
  const state = cloneState();
  const task = ensureTaskRecord(state, "SHEEP-312");
  task.status = "COMPLETE";
  delete task.controller_decision;
  state.last_closed_task = "SHEEP-312";
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("LAST_CLOSED_TASK_CONTRADICTS_CLOSURE"));
});

test("Controller PASS is required for the recorded last closed task", () => {
  const state = cloneState();
  const task = ensureTaskRecord(state, "SHEEP-312");
  task.controller_decision = "REPAIR";
  state.last_closed_task = "SHEEP-312";
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("LAST_CLOSED_TASK_CONTRADICTS_CLOSURE"));
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

test("accepted offline lanes cannot be summarized as an unstarted whole task", () => {
  const state = cloneState();
  const task = ensureCurrentTask(state);
  task.lane_a = { status: "SEALED", controller_decision: "PASS" };
  state.current_task = `${state.next_authoritative_roadmap_id} — NOT_STARTED`;
  state.next_task = `${state.next_authoritative_roadmap_id} — NOT_STARTED`;
  task.status = "NOT_STARTED / NOT_AUTHORIZED";
  const errors = validateProjectState(state, { roadmapText });
  assert.deepEqual(
    errors.filter((error) => error.code === "ACCEPTED_LANE_PROJECTED_NOT_STARTED").map((error) => error.field),
    ["current_task", "next_task", `${nextTaskKey}.status`],
  );
});

test("roadmap baseline remains historical and does not claim current progress", () => {
  const state = cloneState();
  ensureCurrentTask(state).roadmap_status = "NOT_STARTED / NOT_AUTHORIZED";
  assert.deepEqual(validateProjectState(state, { roadmapText }), []);
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
  ensureTaskRecord(state, state.last_closed_task).controller_decision = "REPAIR";
  state[taskKey(laterTaskId(state.next_authoritative_roadmap_id))] = { execution_authorized: true };
  const result = codes(validateProjectState(state, { roadmapText }));
  assert.ok(result.includes("LAST_CLOSED_TASK_CONTRADICTS_CLOSURE"));
  assert.ok(result.includes("LATER_TASK_AUTHORIZED_WHILE_STAGE_NOT_EXECUTED"));
});

test("last-closed task status and roadmap_status cannot contradict closure", () => {
  const state = cloneState();
  ensureTaskRecord(state, state.last_closed_task).roadmap_status = "NOT_STARTED";
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
