// M6 worker status badge (clean-room).
// Renderer-safe statuses only: starting / ready / restarting / stopped / error.
// Projects only the safe lifecycle status; worker internals stay in Main.
import type { UiState } from "../state/view-model.js";
import { clear, el } from "./dom.js";

const LABELS: Record<string, string> = {
  starting: "启动中",
  ready: "就绪",
  restarting: "重启中",
  stopped: "已停止",
  error: "错误",
};

/** Pure mapping from worker lifecycle status to a safe display label. */
export function workerStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function renderWorkerStatusBadge(root: HTMLElement, state: UiState): void {
  clear(root);
  const status = state.viewModel?.worker_status?.status ?? "starting";
  const badge = el("span", `worker-badge worker-${status}`, `AI Worker: ${workerStatusLabel(status)}`);
  const version = state.viewModel?.worker_status?.worker_version;
  if (version) badge.title = `版本 ${version}`;
  root.appendChild(badge);
}
