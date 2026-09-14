import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateProjectState } from "../scripts/validate-project-state.mjs";

const root = resolve(import.meta.dirname, "..");
const actualState = JSON.parse(readFileSync(resolve(root, "project", "PROJECT_STATE.json"), "utf8"));
const roadmapText = readFileSync(resolve(root, "project", "FAST_SHEEP_CODING_ROADMAP_V1.0_REVIEWED.md"), "utf8");

function codes(errors) {
  return errors.map((error) => error.code);
}

function cloneState() {
  return structuredClone(actualState);
}

test("actual PROJECT_STATE satisfies canonical authority and consistency", () => {
  assert.deepEqual(validateProjectState(actualState, { roadmapText }), []);
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
  state.sheep_091.execution_authorized = true;
  assert.ok(codes(validateProjectState(state, { roadmapText })).includes("CURRENT_TASK_EXECUTION_GATE_MISMATCH"));
});

test("paused current task with active live evidence is rejected", () => {
  const state = cloneState();
  state.sheep_091.evidence_acquisition_authorization = "AUTHORIZED WITH CONSTRAINTS";
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
  state.sheep_092 = { execution_authorized: true };
  const result = codes(validateProjectState(state, { roadmapText }));
  assert.ok(result.includes("LAST_CLOSED_TASK_CONTRADICTS_CLOSURE"));
  assert.ok(result.includes("LATER_TASK_AUTHORIZED_WHILE_STAGE_NOT_EXECUTED"));
});
