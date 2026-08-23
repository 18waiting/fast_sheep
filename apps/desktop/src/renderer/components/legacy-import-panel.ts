// M11 legacy import panel (clean-room). Projection + typed controls only.
import type { LegacyImportPanelViewModel, LegacyImportActions } from "./legacy-import-types.js";
import { clear, el, button } from "./dom.js";
import { renderLegacyImportSourceList } from "./legacy-import-source-list.js";
import { renderLegacyImportPlanView } from "./legacy-import-plan-view.js";
import { renderLegacyImportConflictView } from "./legacy-import-conflict-view.js";
import { renderLegacyImportProgress } from "./legacy-import-progress.js";
import { renderLegacyImportResultView } from "./legacy-import-result-view.js";

export function renderLegacyImportPanel(root: HTMLElement, vm: LegacyImportPanelViewModel, actions: LegacyImportActions): void {
  clear(root);
  const panel = el("section", "m11-panel legacy-import-panel");
  panel.appendChild(el("h3", "panel-title", "旧版数据导入"));
  const sourceHost = el("div", "legacy-source-host");
  renderLegacyImportSourceList(sourceHost, vm);
  panel.appendChild(sourceHost);
  const controls = el("div", "panel-actions");
  controls.appendChild(button("import-select", "选择文件", () => actions.onSelect()));
  controls.appendChild(button("import-scan", "扫描", () => actions.onScan()));
  controls.appendChild(button("import-plan", "生成计划", () => actions.onPlan()));
  controls.appendChild(button("import-dryrun", "试运行", () => actions.onDryRun()));
  controls.appendChild(button("import-apply", "开始导入", () => actions.onApply()));
  controls.appendChild(button("import-cancel", "取消", () => actions.onCancel()));
  controls.appendChild(button("import-refresh", "刷新状态", () => actions.onRefreshStatus()));
  panel.appendChild(controls);
  const planHost = el("div", "legacy-plan-host");
  renderLegacyImportPlanView(planHost, vm);
  panel.appendChild(planHost);
  const conflictHost = el("div", "legacy-conflict-host");
  renderLegacyImportConflictView(conflictHost, vm);
  panel.appendChild(conflictHost);
  const progressHost = el("div", "legacy-progress-host");
  renderLegacyImportProgress(progressHost, vm);
  panel.appendChild(progressHost);
  const resultHost = el("div", "legacy-result-host");
  renderLegacyImportResultView(resultHost, vm);
  panel.appendChild(resultHost);
  root.appendChild(panel);
}
