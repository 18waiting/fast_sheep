// M10 background jobs panel (clean-room). Projection of Main-owned job state.
// Controls only cancel/refresh; no job mutation from the renderer.
import type { M10PanelViewModel, M10PanelActions } from "./m10-panel-types.js";
import { JOB_STATE_LABELS } from "./m10-panel-types.js";
import { clear, el, button } from "./dom.js";

export function renderBackgroundJobsPanel(root: HTMLElement, m10: M10PanelViewModel, actions: M10PanelActions): void {
  clear(root);
  const panel = el("section", "m10-panel jobs-panel");
  const title = el("h3", "panel-title", "后台任务");
  panel.appendChild(title);
  const list = el("ul", "jobs-list");
  for (const job of m10.jobs) {
    const li = el("li", "job-item job-" + job.state.toLowerCase());
    li.appendChild(el("span", "job-id", job.job_id));
    li.appendChild(el("span", "job-type", job.type));
    li.appendChild(el("span", "job-state", JOB_STATE_LABELS[job.state] ?? job.state));
    li.appendChild(el("span", "job-progress", job.progress + "%"));
    if (job.state === "RUNNING" || job.state === "QUEUED") {
      li.appendChild(button("job-cancel", "取消", () => actions.onCancelJob(job.job_id)));
    }
    list.appendChild(li);
  }
  panel.appendChild(list);
  panel.appendChild(button("jobs-refresh", "刷新", () => actions.onRefreshJobs()));
  root.appendChild(panel);
}
