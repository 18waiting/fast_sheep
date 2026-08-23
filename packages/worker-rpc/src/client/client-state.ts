// Clean-room implementation (TASK-017 M2). Explicit client state model.
export type ClientState =
  | "STOPPED"
  | "STARTING"
  | "READY"
  | "STOPPING"
  | "CRASHED"
  | "RESTARTING";

export const CLIENT_STATES: ClientState[] = [
  "STOPPED",
  "STARTING",
  "READY",
  "STOPPING",
  "CRASHED",
  "RESTARTING",
];

export function isTerminal(state: ClientState): boolean {
  return state === "STOPPED" || state === "CRASHED";
}
