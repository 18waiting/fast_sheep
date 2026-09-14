#!/usr/bin/env node
// Read-only consistency validation for the canonical PROJECT_STATE lifecycle.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ACTIVE_AUTHORIZATION = new Set([
  "ACTIVE",
  "APPROVED",
  "AUTHORIZED",
  "AUTHORIZED WITH CONSTRAINTS",
]);

const DEFAULT_AUTHORITY_FIELDS = [
  "current_phase",
  "current_milestone",
  "last_closed_task",
  "next_authoritative_roadmap_id",
  "next_task_execution_authorized",
  "current_live_evidence_authorization",
  "next_stage_not_executed",
];

const LATER_TASK_EXECUTION_INDICATORS = /\b(?:IMPLEMENTED|PASS|CLOSED|EXECUTED|IN_PROGRESS|COMPLETE|COMPLETED|ACCEPTED|FAIL|FAILED|PARTIAL|REPAIR)\b/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function taskNumber(taskId) {
  const match = /^SHEEP-(\d{3})$/.exec(taskId ?? "");
  return match ? Number(match[1]) : null;
}

function firstTaskId(value) {
  const match = /^SHEEP-\d{3}\b/.exec(String(value ?? "").trim());
  return match ? match[0] : null;
}

function isActiveAuthorization(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const normalized = String(value).trim().toUpperCase();
  if (normalized.includes("PAUSED") || normalized.includes("NOT_AUTHORIZED") || normalized === "CLOSED") return false;
  return ACTIVE_AUTHORIZATION.has(normalized);
}

function taskObjectFor(state, taskId) {
  const key = String(taskId ?? "").toLowerCase().replace("-", "_");
  return state[key];
}

function closureContradicts(task) {
  if (!isObject(task)) return false;
  const statusClass = lifecycleClass(task.status);
  const roadmapStatusClass = lifecycleClass(task.roadmap_status);
  const controllerClass = lifecycleClass(task.controller_decision);
  if (controllerClass !== null && controllerClass !== "CLOSED") return true;
  if (statusClass !== null && statusClass !== "CLOSED") return true;
  if (roadmapStatusClass !== null && roadmapStatusClass !== "CLOSED") return true;
  return statusClass !== null && roadmapStatusClass !== null && statusClass !== roadmapStatusClass;
}

function lifecycleClass(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().toUpperCase();
  if (/\bNOT_STARTED\b/.test(normalized)) return "NOT_STARTED";
  if (/\b(?:CLOSED|PASS)\b/.test(normalized)) return "CLOSED";
  if (/\b(?:IMPLEMENTED|EXECUTED|IN_PROGRESS|COMPLETE|COMPLETED|ACCEPTED)\b/.test(normalized)) return "EXECUTED";
  if (/\b(?:FAIL|FAILED|REPAIR|PARTIAL|AWAITING|BLOCKED|SKIPPED|CANCELLED)\b/.test(normalized)) return "NOT_CLOSED";
  return "UNKNOWN";
}

function laterTaskLifecycleFields(task) {
  return [
    task.status,
    task.roadmap_status,
    task.result,
    task.codex_result,
    task.controller_decision,
    task.implementation_result,
    task.execution_result,
  ].filter((value) => value !== null && value !== undefined);
}

function independentlyProvesLaterTaskExecution(value) {
  if (value === null || value === undefined || value === "") return false;
  return LATER_TASK_EXECUTION_INDICATORS.test(String(value).trim().toUpperCase());
}

function roadmapTaskIds(roadmapText) {
  return [...String(roadmapText ?? "").matchAll(/^###\s+(SHEEP-\d{3})\b/gm)].map((match) => match[1]);
}

export function validateProjectState(state, options = {}) {
  const errors = [];
  const add = (code, field, message) => errors.push({ code, field, message });
  const authority = state?.state_authority;

  if (!isObject(state)) {
    return [{ code: "STATE_NOT_OBJECT", field: "$", message: "PROJECT_STATE must be an object" }];
  }
  if (!isObject(authority)) {
    add("AUTHORITY_DECLARATION_MISSING", "state_authority", "state_authority declaration is required");
  } else {
    const fields = authority.canonical_current_fields;
    if (!Array.isArray(fields) || DEFAULT_AUTHORITY_FIELDS.some((field) => !fields.includes(field))) {
      add("AUTHORITY_FIELDS_INCOMPLETE", "state_authority.canonical_current_fields", "all canonical current fields must be declared");
    }
  }

  const nextId = state.next_authoritative_roadmap_id;
  if (taskNumber(nextId) === null) {
    add("NEXT_TASK_ID_INVALID", "next_authoritative_roadmap_id", "next task must be a SHEEP-NNN identifier");
  }

  for (const field of ["current_task", "next_task", "next_action"]) {
    const id = firstTaskId(state[field]);
    if (id !== nextId) {
      add("PROJECTION_TASK_ID_MISMATCH", field, `${field} must identify ${nextId}`);
    }
  }

  if (Object.hasOwn(state, "lifecycle_stage") && state.lifecycle_stage !== state.current_phase) {
    add("LIFECYCLE_STAGE_PHASE_MISMATCH", "lifecycle_stage", "lifecycle_stage must match canonical current_phase");
  }

  if (state.next_task_execution_authorized !== state.current_execution_authorization) {
    add("EXECUTION_GATE_MIRROR_MISMATCH", "current_execution_authorization", "execution mirror must match next_task_execution_authorized");
  }

  const currentTaskId = firstTaskId(state.current_task);
  const currentTask = taskObjectFor(state, currentTaskId);
  if (isObject(currentTask)) {
    if (Object.hasOwn(currentTask, "phase") && currentTask.phase !== state.current_phase) {
      add("CURRENT_TASK_PHASE_MISMATCH", `sheep_${taskNumber(currentTaskId)}.phase`, "current task phase must match canonical current phase");
    }
    if (Object.hasOwn(currentTask, "milestone") && currentTask.milestone !== state.current_milestone) {
      add("CURRENT_TASK_MILESTONE_MISMATCH", `sheep_${taskNumber(currentTaskId)}.milestone`, "current task milestone must match canonical current milestone");
    }
    if (Object.hasOwn(currentTask, "next_stage_not_executed")
      && currentTask.next_stage_not_executed !== state.next_stage_not_executed) {
      add("CURRENT_TASK_NEXT_STAGE_PROJECTION_MISMATCH", `sheep_${taskNumber(currentTaskId)}.next_stage_not_executed`, "current task next-stage projection must match canonical gate");
    }
    if (currentTask.execution_authorized !== state.next_task_execution_authorized) {
      add("CURRENT_TASK_EXECUTION_GATE_MISMATCH", `sheep_${taskNumber(currentTaskId)}.execution_authorized`, "current task projection must match canonical execution gate");
    }
    if (Object.hasOwn(currentTask, "current_execution_authorization")
      && currentTask.current_execution_authorization !== state.next_task_execution_authorized) {
      add("CURRENT_TASK_EXECUTION_MIRROR_MISMATCH", `sheep_${taskNumber(currentTaskId)}.current_execution_authorization`, "current task mirror must match canonical execution gate");
    }
    if (Object.hasOwn(currentTask, "current_live_evidence_authorization")
      && currentTask.current_live_evidence_authorization !== state.current_live_evidence_authorization) {
      add("CURRENT_TASK_LIVE_EVIDENCE_MISMATCH", `sheep_${taskNumber(currentTaskId)}.current_live_evidence_authorization`, "current task evidence projection must match canonical current evidence state");
    }
    if (!state.next_task_execution_authorized && isActiveAuthorization(currentTask.execution_authorized)) {
      add("PAUSED_TASK_WITH_CURRENT_EXECUTION", `sheep_${taskNumber(currentTaskId)}.execution_authorized`, "paused canonical gate cannot coexist with active task execution authorization");
    }
    if (!state.next_task_execution_authorized && isActiveAuthorization(currentTask.evidence_acquisition_authorization)) {
      add("PAUSED_TASK_WITH_LIVE_EVIDENCE", `sheep_${taskNumber(currentTaskId)}.evidence_acquisition_authorization`, "paused task cannot have active live-evidence authorization");
    }
    if (!state.next_task_execution_authorized && isActiveAuthorization(currentTask.codex_dom_observation_authorization)) {
      add("PAUSED_TASK_WITH_BROWSER_OBSERVATION", `sheep_${taskNumber(currentTaskId)}.codex_dom_observation_authorization`, "paused task cannot have active browser-observation authorization");
    }
  }

  if (!state.next_task_execution_authorized && isActiveAuthorization(state.current_live_evidence_authorization)) {
    add("PAUSED_TASK_WITH_CANONICAL_LIVE_EVIDENCE", "current_live_evidence_authorization", "paused task cannot have active canonical live-evidence authorization");
  }

  const lastClosedTask = taskObjectFor(state, state.last_closed_task);
  if (closureContradicts(lastClosedTask)) {
    add("LAST_CLOSED_TASK_CONTRADICTS_CLOSURE", `sheep_${taskNumber(state.last_closed_task)}`, "last closed task status/controller contradicts closure");
  }

  const phaseEntryKey = `${String(state.current_phase ?? "").toLowerCase()}_entry`;
  const activePhaseEntry = state[phaseEntryKey];
  if (isObject(activePhaseEntry)) {
    if (Object.hasOwn(activePhaseEntry, "current_milestone") && activePhaseEntry.current_milestone !== state.current_milestone) {
      add("PHASE_ENTRY_MILESTONE_MISMATCH", `${phaseEntryKey}.current_milestone`, "phase entry milestone must match canonical current milestone");
    }
    if (Object.hasOwn(activePhaseEntry, "next_authoritative_roadmap_id") && activePhaseEntry.next_authoritative_roadmap_id !== nextId) {
      add("PHASE_ENTRY_NEXT_TASK_MISMATCH", `${phaseEntryKey}.next_authoritative_roadmap_id`, "phase entry next task must match canonical next task");
    }
  }

  if (state.next_stage_not_executed === true && taskNumber(nextId) !== null) {
    for (const [key, value] of Object.entries(state)) {
      const objectTaskNumber = /^sheep_(\d{3})$/.exec(key)?.[1];
      if (!objectTaskNumber || Number(objectTaskNumber) <= taskNumber(nextId) || !isObject(value)) continue;
      if (value.execution_authorized === true || value.current_execution_authorization === true || value.later_tasks_authorized === true) {
        add("LATER_TASK_AUTHORIZED_WHILE_STAGE_NOT_EXECUTED", key, "later task must not be authorized while next_stage_not_executed=true");
      }
      const executedLifecycleField = laterTaskLifecycleFields(value).find(independentlyProvesLaterTaskExecution);
      if (executedLifecycleField !== undefined) {
        add("LATER_TASK_EXECUTED_WHILE_STAGE_NOT_EXECUTED", key, "later task must not have an executed/closed lifecycle while next_stage_not_executed=true");
      }
    }
  }

  if (options.roadmapText !== undefined) {
    const ids = roadmapTaskIds(options.roadmapText);
    const lastIndex = ids.indexOf(state.last_closed_task);
    const nextIndex = ids.indexOf(nextId);
    if (!ids.length || lastIndex < 0 || nextIndex < 0 || nextIndex <= lastIndex) {
      add("ROADMAP_IDENTITY_ORDER_MISMATCH", "roadmap", "last closed and next task must exist in Roadmap order");
    }
  }

  return errors;
}

function loadRoadmap(state, statePath) {
  const roadmapPath = state?.state_authority?.roadmap_identity_source ?? state?.roadmap?.reviewed_path;
  if (!roadmapPath) return "";
  const base = resolve(statePath, "..", "..");
  return readFileSync(resolve(base, roadmapPath.replaceAll("\\", "/")), "utf8");
}

function main() {
  const statePath = resolve(process.argv[2] ?? "project/PROJECT_STATE.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const errors = validateProjectState(state, { roadmapText: loadRoadmap(state, statePath) });
  if (errors.length) {
    for (const error of errors) console.error(`${error.code}: ${error.field}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log("PROJECT_STATE_CONSISTENCY=PASS");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
