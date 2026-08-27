# Fast Sheep Empty / Error / Loading States（SHEEP-046）

> 项目：Fast Sheep / 快羊客服 · Phase 3 / M3.2 · 日期：2026-08-27
> 定位：State patterns（thin helper/composition）+ 首次 production primitive adoption（error-banner / conversation-empty / suggestion-empty）；NO_TOPOLOGY_CHANGE。
> 依据：DP-41~48（Owner 收紧决策）、DP-22~40、SHEEP-043/044/045。
> FastWork reference 仅作 workflow/IA inspiration；非视觉/几何 spec，不 pixel-match。

## 1. 决策落地（DP-41~48）

| DP | 决策 | 落地 |
|---|---|---|
| DP-41 | MINIMAL_PRESENTATION_FAMILIES_WITH_EXPLICIT_STATE_MEANING | Empty/Loading/Error 为 presentation families；Empty meaning 显式区分 no-work / no-result / not-configured / not-yet-created（`data-state-meaning`）；不机械用同一 CTA |
| DP-42 | QUIET_TEXTUAL_PROGRESS_WITH_OPTIONAL_MINIMAL_INDICATOR | Loading 文本优先 + 可选极简「…」indicator；非 Status Badge 主导；无 skeleton/玩具动画；不伪造未知 progress |
| DP-43 | ERROR_PLACEMENT_FOLLOWS_FAILURE_SCOPE | error scope = inline/section/workspace；就近/留 section/全局 banner；无 error dialog |
| DP-44 | 有限真实 consumer adoption | 迁移 error-banner / conversation-empty / suggestion-empty（exact files）；suggestion-empty 仅 baseline consumer validation，不锁定最终产品行为 |
| DP-45 | PRESERVE_LAST_KNOWN_USEFUL_CONTENT_DURING_REFRESH | 记录为后续 invariant（本单元无既有 refresh workflow，不实现） |
| DP-46 | THIN_STATE_PATTERNS_NO_MEGA_STATE_COMPONENT | 无 options 膨胀的 renderState/framework；薄 helper/composition |
| DP-47 | FAILURE_IS_CONTAINED_TO_AFFECTED_SCOPE | AI/可选 Context 失败不得遮蔽 Conversation/source facts/manual workflow |
| DP-48 | ABSENCE_MUST_NOT_CONCEAL_DENIAL_UNAVAILABILITY_OR_NOT_CONFIGURED | Empty 不得把 denied/unavailable/not-configured 伪装成「没有数据」；本任务只固化语义边界，不实现 entitlement/auth UI |

## 2. State Patterns（thin helpers）

- `components/states/empty.ts`：`emptyState({ meaning, title, body, action? })`——condition/impact 优先；action 仅真正 actionable 时提供（无默认 CTA）。
- `components/states/loading.ts`：`loadingState({ label, indicator? })`——quiet textual + 极简「…」；role=status。
- `components/states/error.ts`：`errorState({ scope, message, retry? })`——inline/section/workspace；copy 描述影响+恢复，无 raw 实现细节；role=alert。

## 3. Consumers（DP-44，exact files；DOM native semantics / 事件 / 业务行为保持）

- `error-banner.ts` → `errorState({ scope: "workspace", message })`（sanitized，slice 200 保持）
- `conversation-panel.ts` → `emptyState({ meaning: "no-work", ... })`
- `suggestion-panel.ts` → `emptyState({ meaning: "no-result", ... })`（**baseline consumer validation only；不锁定「暂无 AI 建议必须永久 Empty」**）

## 4. State Gallery（evidence-only）

- `reports/visual-evidence/state-gallery.html`：覆盖 no-work / no-result+action / initial loading / quiet refresh concept / inline error+retry / workspace-banner error / AI-assistance failure 且 source facts+manual path 可用。
- 不进入 production navigation/runtime。

## 5. Invariant 记录（非本单元实现）

- DP-45：后台刷新时保留最后已知有用内容（后续 invariant）。
- DP-47：AI/Context 失败不得阻断 Conversation/source facts/manual workflow。
- DP-48：absence 不掩盖 denied/unavailable/not-configured（语义边界）。

## 6. 边界

- NO_TOPOLOGY_CHANGE；仅列出 consumers 迁移；未借本单元重做 Conversation/AI/Store IA。
- 无品牌插画/玩具化 icon/AI skin；无 FastWork 视觉值；无远程字体/dark/density。
- 未挂载 AI primitive；未实现 Phase 4；schema v7 不变；无 sync/Outbox。