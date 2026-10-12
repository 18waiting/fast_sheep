# AU-01 — Canonical State and Projection Reconciliation Plan

> **状态:** COMPLETE / CONTROLLER_PASS / CLOSED
> **计划日期:** 2026-10-02
> **前置决定:** SHEEP-312 Controller `PASS`（已记录在 `project/FAST_SHEEP_RISK_REMEDIATION_ACCEPTANCE_UNITS.md`）
> **执行记录:** AU-01 已于 2026-10-03 完成状态对账，并获得 Controller PASS。
> **唯一不变量:** 只有 Controller 决定可以关闭任务；canonical lifecycle 字段与所有投影必须一致，任何授权门都不能被投影绕过。
> **对应风险:** R-01、R-02、R-03、R-07、R-08

---

## 1. 目标

AU-01 的目标不是继续开发功能，而是把项目导航和授权状态恢复成一个可靠、可重复、可验证的单一事实源。

完成后必须满足:

- SHEEP-312 的 Controller `PASS` 被正确记录。
- `last_closed_task` 与 Controller 决定一致。
- canonical 下一任务指针有明确、唯一的来源。
- 所有导航投影不再指向旧任务。
- `next_action` 的字段含义和校验规则明确。
- 历史入口具有明确的 authority/supersession 处理。
- 状态校验器和一致性测试重新成为可信的回归保护。
- 所有原有安全授权保持关闭，除非另有独立授权。

AU-01 不改变业务行为，不修改发送路径，不启用 AUTO，不启动 SHEEP-313。

---

## 2. 当前已知事实

```text
CONFIRMED:
- SHEEP-312 Codex result = COMPLETE。
- 当前会话已明确给出 SHEEP-312 Controller PASS。
- PROJECT_STATE.json 仍记录 last_closed_task = SHEEP-311。
- next_authoritative_roadmap_id = SHEEP-312。
- next_task_execution_authorized = false。
- current_execution_authorization = false。
- current_live_evidence_authorization = PAUSED / NOT_AUTHORIZED。
- current_authorization_pause_reason 仍指向 SHEEP-305。
- next_task 和 mvp_a_foundation_entry 仍指向 SHEEP-305。
- validator 当前报 3 个错误。
- 状态一致性测试当前为 12/20 通过、8/20 失败。

INFERRED:
- canonical 状态在 PASS 后需要推进，但具体 lifecycle phase/milestone 命名需由 Controller 确认。
- 近期任务使用平铺字段，而 validator/测试部分假设聚合对象，需要统一契约。

PRODUCT_DECISION_REQUIRED:
- SHEEP-313 是否作为 PASS 后的 canonical next task，以及其正式执行授权是否开启。
- SHEEP-312 PASS 后 current_phase/current_milestone 的目标值及命名。

BLOCKED:
- 无必要条件阻止 AU-01 规划。
- AU-01 执行仍等待 Controller 明确授权。

DEFERRED:
- SHEEP-313 实际执行。
- 真实发送、AUTO 和生产启用。
```

---

## 3. 允许范围

- 修改 `project/PROJECT_STATE.json` 中与当前生命周期和导航相关的 canonical 字段与投影字段。
- 修改 `scripts/validate-project-state.mjs` 的状态契约校验。
- 修改 `tests/project-state-consistency.test.mjs`，使其与决定后的状态契约一致。
- 增加状态 schema/契约说明或生成投影的最小脚本。
- 更新本计划文档和 AU-01 报告。
- 只读核对历史任务记录的形状。

---

## 4. 禁止范围

- 不修改业务代码。
- 不修改 `packages/orchestrator`、`packages/domain`、PDD Adapter、AI Worker 或发送路径。
- 不启动 SHEEP-313。
- 不打开 `next_task_execution_authorized`，除非 Controller 单独明确授权。
- 不打开 live evidence、真实发送、AUTO 或生产启用。
- 不删除历史记录来掩盖漂移。
- 不为通过测试而伪造状态。
- 不自动分配或复用 V1.0 历史任务 ID。

---

## 5. 任务拆解

### WU-01 — 记录 SHEEP-312 Controller PASS

**目标:** 把 PASS 从计划文档同步到 canonical task record。

**输入:**

- `project/FAST_SHEEP_RISK_REMEDIATION_ACCEPTANCE_UNITS.md`
- `project/PROJECT_STATE.json`
- `project/SHEEP_312_TASK_REPORT.md`

**计划动作:**

- 为 SHEEP-312 增加统一的 Controller 决定记录格式。
- 记录 `controller_decision = PASS`。
- 记录 `closed_date = 2026-10-02`。
- 更新 `last_closed_task = SHEEP-312`。

**禁止:**

- 不使用 PASS 作为 SHEEP-313 执行授权。
- 不改变 AUTO 或 live evidence 授权。

**验证:**

- SHEEP-312 同时记录 `COMPLETE + PASS`。
- `last_closed_task` 不再停留在 SHEEP-311。
- 授权字段仍为 false/paused。

---

### WU-02 — 确定 PASS 后的 lifecycle 指针

**目标:** 解决 `current_phase`、`current_milestone` 和下一任务指针仍停留在旧值的问题。

**AU-01 已采用的状态方案:**

```text
current_phase = MVP_E_MULTI_SHOP_EXPANSION
current_milestone = MVP-E MULTI_SHOP_EXPANSION
current_milestone_state = PLANNED / NOT_AUTHORIZED
last_completed_milestone = MVP-D AUTO
last_closed_task = SHEEP-312
next_authoritative_roadmap_id = SHEEP-313
next_task_execution_authorized = false
current_live_evidence_authorization = PAUSED / NOT_AUTHORIZED
next_stage_not_executed = true
current_authorization_pause_reason = SHEEP_313_PLANNED_AWAITING_CONTROLLER_EXECUTION_AUTHORIZATION
```

**说明:** 里程碑身份与实际执行状态已经拆开。`MVP-E` 是当前规划里程碑，`PLANNED / NOT_AUTHORIZED` 明确表示它尚未获得执行授权。

**验证:**

- next pointer 与 Roadmap 一致。
- next pointer 不产生执行授权。
- 旧任务 SHEEP-305、SHEEP-308 不再作为当前入口。

---

### WU-03 — 统一 Task Record 形状

**目标:** 解决近期任务使用平铺字段、validator/测试却假设聚合对象的问题。

**当前观察:**

- `sheep_311_status`、`sheep_311_result` 等为平铺字段。
- 测试中访问 `state.sheep_311.controller_decision` 时会得到 undefined。
- 历史任务和近期任务形状不完全一致。

**需要确定的契约:**

- 保留平铺字段，并让 validator/test 适配平铺结构。
- 或引入统一聚合对象，并把近期任务迁移过去。
- 或同时支持 legacy flat 和 current nested 两种形状，但必须由显式 schema/version 区分。

**推荐:**

- 对当前和后续任务使用统一、版本化的 task record。
- 对历史任务保留原样，或通过兼容读取器处理。
- 禁止测试直接假设未定义的嵌套字段。

**验证:**

- 历史任务不会因为形状差异误报。
- 当前任务能通过统一读取器访问。
- 缺失 Controller 决定时不得被解释为 PASS。

---

### WU-04 — 明确 `next_action` 契约

**目标:** 解决自然语言 `next_action` 与 validator 的正则解析不一致。

**方案 A:** 保留自由文本，validator 不再要求任务号必须出现在字符串开头。

**方案 B:** 改为结构化对象:

```json
{
  "task_id": "SHEEP-313",
  "action": "CONTROLLER_REVIEW_EXECUTION_AUTHORIZATION",
  "authorized": false
}
```

**推荐:** 方案 B。原因是状态治理需要可机器读取，不能依赖自然语言句子。

**验证:**

- 合法 next action 只对应一个任务 ID。
- action 与 canonical next task 一致。
- `authorized` 不能替代 actual execution gate。
- 自由文本不再造成假阳性。

---

### WU-05 — 对账所有 Lifecycle 投影

**目标:** 让 canonical 字段与所有投影保持一致。

**需要处理:**

- `current_task`
- `next_task`
- `next_action`
- `lifecycle_stage`
- `current_execution_authorization`
- `current_authorization_pause_reason`
- `mvp_a_foundation_entry`
- `project_state_reconciliation`
- `next_sheep_task_after_governance`
- 历史 `phase_*_entry`

**规则:**

- canonical 字段决定真实状态。
- 投影只能描述 canonical 状态，不能产生授权。
- 历史入口必须保留 provenance，但不得被自动导航当作当前入口。
- `phase_5_entry.status=ACTIVE` 必须通过 authority/supersession 规则解释，不能单独决定当前状态。

**验证:**

- validator 不再报 `PROJECTION_TASK_ID_MISMATCH`。
- 不再报 `PHASE_ENTRY_NEXT_TASK_MISMATCH`。
- 所有当前入口指向同一任务。
- 历史入口仍有明确的历史标记。

---

### WU-06 — 修复状态 Validator

**目标:** 让 validator 能准确识别合法状态和非法状态。

**计划动作:**

- 统一 task record 读取器。
- 校正 `firstTaskId()` 对 `next_action` 的解析。
- 只让 canonical 字段决定任务推进。
- 增加对 PASS 与 `last_closed_task` 的双向一致性校验。
- 增加授权字段关闭状态的负向校验。
- 保留历史任务兼容性。

**必须新增或强化的规则:**

- `COMPLETE` 但无 `PASS` 时，不得成为 `last_closed_task`。
- `PASS` 后 `last_closed_task` 未更新时报错。
- `last_closed_task` 指向任务但无 PASS 时报错。
- `next_action` 指向错误任务时报错。
- phase entry 指向旧任务时报错。
- `next_task_execution_authorized=true` 但无明确授权记录时报错。
- paused 状态下 live evidence 仍 active 时报错。

---

### WU-07 — 修复状态一致性测试

**目标:** 让测试使用真实状态结构验证 invariant，而不是假设不存在的对象。

**计划动作:**

- 替换 `state.sheep_311.controller_decision` 一类未定义访问。
- 使用统一 task accessor 或 schema version。
- 保留“合法状态必须无错误”的基线测试。
- 增加 PASS、closure、projection、authorization 的负向测试。

**必需测试场景:**

1. 合法 PASS 状态通过。
2. COMPLETE 无 PASS 被拒绝。
3. PASS 但 last_closed 未更新被拒绝。
4. last_closed 更新但任务无 PASS 被拒绝。
5. projection 指向旧任务被拒绝。
6. next_action 指向错误任务被拒绝。
7. current task execution true 但授权 false 被拒绝。
8. paused live evidence 但 active 被拒绝。
9. 历史 closed task 形状差异不误报。
10. 历史入口不覆盖 canonical current task。

**验收目标:**

```text
node scripts/validate-project-state.mjs
=> 0 errors

node --test tests/project-state-consistency.test.mjs
=> all tests pass (current baseline: 23/23)
```

---

### WU-08 — 验证和报告

**目标:** 产出 AU-01 的独立验收证据。

**必需输出:**

- AU-01 task report。
- validator 输出。
- 状态一致性测试输出。
- 修改前后 canonical/投影对照。
- 授权门未变化的证据。
- `git diff` 仅限允许范围内文件。
- `next_stage_not_executed = true`。
- 未访问或修改只读参考树。

**最终结果只能是:**

- `COMPLETE`
- `PARTIAL`
- `FAIL`
- `NOT_RUN`

Codex `COMPLETE` 仍需 Controller `PASS` 才能关闭 AU-01。

---

## 6. 验收标准

| ID | 验收标准 |
|---|---|
| AC-01 | SHEEP-312 的 Controller PASS 已正确记录。 |
| AC-02 | `last_closed_task` 与 PASS 后的状态一致。 |
| AC-03 | canonical 下一任务指针明确且与 Roadmap 一致。 |
| AC-04 | 所有当前导航投影指向同一任务，不再指向 SHEEP-305/308。 |
| AC-05 | `next_action` 的契约被明确并实现。 |
| AC-06 | 历史阶段入口具有明确 authority/supersession 处理。 |
| AC-07 | task record 形状在 validator 和测试中一致。 |
| AC-08 | `validate-project-state.mjs` 为 0 errors。 |
| AC-09 | 状态一致性测试全部通过（当前 23/23）。 |
| AC-10 | `next_task_execution_authorized`、live evidence、AUTO 和生产启用保持原授权状态。 |
| AC-11 | 不修改业务行为、发送路径、平台 Adapter 或 AI Worker。 |
| AC-12 | AU-01 报告完整，`next_stage_not_executed = true`。 |

---

## 7. 失败和停止条件

出现以下任一情况时，AU-01 不得标记 COMPLETE:

- Controller 对 lifecycle 目标值未确认。
- 为通过测试而篡改历史状态。
- PASS 被错误解释为 SHEEP-313 执行授权。
- 任何真实发送、AUTO、live evidence 或生产授权被打开。
- validator 仍有错误。
- 状态一致性测试仍有失败。
- 修改了任务范围外业务代码。
- 无法证明只读参考树未修改。

---

## 8. 当前状态

```text
AU-01 RESULT: COMPLETE
Controller Review: PASS
Controller Review Date: 2026-10-03
Validator: PROJECT_STATE_CONSISTENCY=PASS
Consistency Tests: 23/23 PASS
PROJECT_STATE Changes: APPLIED
Business Code Changes: NONE
SHEEP-313 Started: NO
Real Send: NOT_AUTHORIZED
AUTO: NOT_GRANTED
Next Stage Executed: NO
```

## 9. Execution Record — 2026-10-03

### 已修改

- `project/PROJECT_STATE.json`：记录 SHEEP-312 PASS，推进 canonical 指针，增加里程碑状态字段，新增 MVP-E 当前入口，显式标记 MVP-A 和 Phase 5 为历史入口。
- `scripts/validate-project-state.mjs`：支持结构化 `next_action`，统一读取平铺与嵌套 task record，扩展 canonical 字段校验。
- `tests/project-state-consistency.test.mjs`：修复状态结构假设，新增 PASS/closure/next_action 负向测试。
- `project/FAST_SHEEP_RISK_REMEDIATION_ACCEPTANCE_UNITS.md`：记录 AU-01 执行结果。
- `reports/AU-01-canonical-state-reconciliation-report.json`：AU-01 验收报告。

### 验证结果

- `node scripts/validate-project-state.mjs`：PASS。
- `node --test tests/project-state-consistency.test.mjs`：23/23 PASS。
- `next_task_execution_authorized=false`。
- `current_live_evidence_authorization=PAUSED / NOT_AUTHORIZED`。
- AUTO 保持 `NOT_GRANTED`。
- SHEEP-313 已指向但未启动。

### 授权状态

AU-01 的 Codex 结果为 `COMPLETE`，但仍需 Controller `PASS` 才能关闭。AU-01 完成不代表 SHEEP-313 或真实发送获授权。
