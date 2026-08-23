# FAST_SHEEP_CODEX_TASK_TEMPLATE.md

# 快羊客服 Codex 通用任务模板

> **用途**：所有 `SHEEP-*` coding / audit / migration / UI / cloud / platform / test 任务都应从本模板派生。  
> **要求**：一个 Prompt = 一个可独立验收的 Acceptance Unit。  
> **母提示词**：开始任务前必须读取 `PROJECT_STATE.json` 中 `master_prompt.path` 指向的 active Master Prompt；不得凭文件名猜测。

---

# 0. TASK IDENTITY

```text
Task: SHEEP-XXX
Phase: Phase X — <name>
Milestone: Mx.y — <name>
Acceptance Unit: <one independently verifiable unit>
```

你是快羊客服（Fast Sheep）项目的执行工程师。

项目根目录：

`E:\fast_sheep\`

所有主动项目写入必须位于该根目录。

旧参考：

- `E:\ai客服数据\FastWork\rebuild\` — READ ONLY
- `E:\ai客服数据\FastWork_asar_extracted\dist\renderer\` — READ ONLY，且仅在 UI reference 任务明确需要时读取

不要自动执行下一任务。

---

# 1. READ MASTER CONSTITUTION FIRST

必须首先读取：

`E:\fast_sheep\project\PROJECT_STATE.json`

从其中读取：

`master_prompt.path`

然后读取该 exact active Master Prompt。

当前 pre-approval 阶段预期为：

`E:\fast_sheep\project\FAST_SHEEP_MASTER_PROMPT_V1.0_REVIEWED.md`

Master 正式 APPROVED 后，Controller 可以通过一次治理变更将 active path 切换为：

`E:\fast_sheep\project\FAST_SHEEP_MASTER_PROMPT.md`

然后读取：

`E:\fast_sheep\project\DECISIONS.md`

不得因旧模板示例或历史文件名而自行创建/改名 Master Prompt。

如任一 REQUIRED governance 文件不存在：

当前 task = `PARTIAL`

除非本任务本身就是创建这些文件的 Phase 0 bootstrap task。

---

# 2. CURRENT VERIFIED STATE

这里只列入**已经被 Controller PASS 的事实**。

示例：

```text
Current Verified State:
- SHEEP-021 PASS
- Typed IPC contract X exists
- Current migration version = N
- PDD capability A = CONFIRMED
```

禁止把：

- planned
- inferred-but-unverified
- previous Codex self-claimed COMPLETE without Controller PASS

写成 verified。

---

# 3. EVIDENCE CLASSIFICATION

开始任务前，对关键事实进行分类：

```text
CONFIRMED:
- ...

INFERRED:
- ...

PRODUCT_DECISION_REQUIRED:
- ...

BLOCKED:
- ...

DEFERRED:
- ...
```

规则：

- CONFIRMED → 可直接实施
- INFERRED → 仅限低风险、可逆、无长期产品承诺
- PRODUCT_DECISION_REQUIRED → 被影响部分不得实施
- BLOCKED → 不得伪造
- DEFERRED → 不扩大 scope

---

# 4. SOLE OBJECTIVE

只允许一个目标：

> **<一句话描述本任务唯一可独立验收的结果>**

任何与该目标无直接关系的优化：

`DEFERRED`

不得顺手实施。

---

# 5. READ FIRST — EXACT INPUTS

开始修改前必须读取：

```text
E:\fast_sheep\<exact path 1>
E:\fast_sheep\<exact path 2>
...
```

如本任务属于 UI reference restoration，才允许额外读取：

```text
E:\ai客服数据\FastWork_asar_extracted\dist\renderer\<specific scope>
```

如需要旧 rebuild 机制参考：

```text
E:\ai客服数据\FastWork\rebuild\<specific read-only paths>
```

不要扫描不必要的敏感目录。

---

# 6. REQUIRED ANALYSIS BEFORE IMPLEMENTATION

在改代码前，必须明确：

1. 当前真实实现路径。
2. 当前依赖关系。
3. 当前测试覆盖。
4. 是否存在已有 abstraction 可复用。
5. 是否存在历史实现可以参考。
6. 当前任务是否触发 Decision Gate。
7. 是否会修改：
   - security boundary
   - DB schema
   - IPC
   - Cloud API
   - sync contract
   - entitlement
   - automation policy
8. 是否需要 migration。
9. 是否需要 backward compatibility。
10. 是否需要 negative test。

---

# 7. DECISION GATES

如遇以下重要未知，必须转：

`PRODUCT_DECISION_REQUIRED`

而不是自行决定。

## MONEY
退款、赔付、优惠、套餐、收费、usage、Billing。

## SECURITY
Credential、Cookie、Token、API Key、Session、设备授权。

## DATA
Cloud 同步内容、删除、保留、隐私、迁移。

## AUTOMATION
AI 自动发消息、自动 Tool、Handoff、自动学习生效。

## PRODUCT
删除核心功能、重大 IA、用户流程、页面合并。

## ARCHITECTURE
新数据库、新语言、新微服务、新消息队列、改变 Local-first、改变 Desktop/Cloud 边界。

如果触发，完成其它不依赖该决策的工作后返回 `PARTIAL` 并生成 Decision Package。

---

# 8. ALLOWED CHANGE SCOPE

只允许修改：

```text
E:\fast_sheep\<path A>
E:\fast_sheep\<path B>
```

如需要新增文件：

明确 exact output paths。

不要扩大到同级其它系统。

---

# 9. FORBIDDEN CHANGE SCOPE

本任务禁止修改：

```text
<exact paths>
```

默认禁止：

- `E:\ai客服数据\FastWork\rebuild\**`
- `E:\ai客服数据\FastWork_asar_extracted\dist\renderer\**`
- 与本 Acceptance Unit 无关的模块
- frozen historical evidence
- unrelated migrations
- dependency major upgrades
- 新语言/新基础设施，除非任务明确授权

---

# 10. ARCHITECTURE CONSTRAINTS

从 Master Prompt 中只引用本任务相关约束。

通用 Desktop security：

```text
contextIsolation = true
nodeIntegration = false
sandbox = true
raw ipcRenderer = forbidden
Renderer fs/child_process/sqlite = forbidden
```

通用 AI：

```text
LLM does not self-authorize automatic sending.
Tool execution passes Tool Permission Engine.
```

通用 Cloud：

```text
TypeScript modular monolith
PostgreSQL primary source of truth
No speculative microservices
```

通用 Local-first：

```text
No ad-hoc sync fetch scattered through business logic.
```

---

# 11. IMPLEMENTATION REQUIREMENTS

逐条写出必须实施的内容。

示例：

1. ...
2. ...
3. ...

每一项必须能对应到 completion criteria 或 test evidence。

---

# 12. NEGATIVE REQUIREMENTS

明确本任务必须证明“不会发生”的事情，例如：

- no raw ipcRenderer
- no system Python fallback
- no seller secret upload
- no source-tree runtime dependency
- no cross-merchant data leakage
- no unauthorized tool execution
- no direct knowledge auto-publish
- no unexpected network
- no old project writes

---

# 13. REQUIRED OUTPUTS

以下 exact paths 必须存在：

```text
E:\fast_sheep\...
```

任一 REQUIRED path 缺失：

`result = PARTIAL`

不得 COMPLETE。

---

# 14. REQUIRED TESTS

必须运行：

## Unit
- ...

## Integration
- ...

## Contract
- ...

## Migration
- ...

如不适用，明确写 `NOT APPLICABLE`，不要静默省略。

---

# 15. REQUIRED SMOKE

真实运行级验证：

```text
<smoke entrypoint>
```

至少证明：

- application/service boots
- target behavior works
- target path is actual production path
- no fatal errors
- no unexpected fallback

---

# 16. REQUIRED NEGATIVE TESTS

至少覆盖关键失败路径，例如：

- missing resource
- unauthorized user
- wrong resource scope
- stale version
- cloud unavailable
- invalid signature
- tool denied
- knowledge conflict
- platform capability unavailable

不要只测试 happy path。

---

# 17. SECURITY CHECK

必须明确记录：

```text
security_boundary_changed = true/false
secrets_detected = true/false
raw_ipc_renderer_added = true/false
cross_tenant_or_cross_merchant_access_found = true/false
```

如果 security boundary 被弱化且任务没有明确批准：

FAIL。

---

# 18. DATA / MIGRATION CHECK

如果任务影响 schema：

必须：

- new forward migration
- no editing historical migration
- rollback/recovery strategy
- existing data compatibility test
- migration smoke

如果不影响：

记录：

`data_model_changes = []`

---

# 19. UI REFERENCE SPECIAL RULES

只有 UI restoration 任务使用。

允许参考 owner-authorized renderer。

要求：

- original source read-only
- adopted assets copied into `E:\fast_sheep\`
- production runtime dependency on extracted renderer = 0
- original direct network code default NOT PORTED
- original auth/credential behavior default NOT PORTED
- backend calls rewired to Fast Sheep typed IPC/contracts
- Restore first; redesign only in UI-B phases

---

# 20. PRODUCT DECISION PACKAGE

若触发：

创建：

`E:\fast_sheep\project\decisions\DEC-REQ-<id>.md`

格式：

```text
DECISION ID:
Status: PRODUCT_DECISION_REQUIRED

Question:
Why It Matters:

Confirmed Evidence:
Unknown:

Original Reference Evidence:
Current Fast Sheep Architecture:

Options:
A.
B.
C.

Recommended Option:
Recommendation Reason:

Reversibility:
LOW | MEDIUM | HIGH

Implementation Performed:
NO

Blocked Tasks:
```

当前 task 正常返回 `PARTIAL`，除非 Decision 不影响 REQUIRED objective。

---

# 21. REQUIRED TASK REPORT

创建：

`E:\fast_sheep\reports\<task-specific-report>.json`

至少包含：

```json
{
  "task": "SHEEP-XXX",
  "result": "COMPLETE | PARTIAL | FAIL | NOT_RUN",
  "phase": "...",
  "milestone": "...",
  "objective": "...",
  "completed_requirements": 0,
  "total_requirements": 0,
  "evidence": {
    "confirmed": [],
    "inferred": []
  },
  "blockers": [],
  "decisions_required": [],
  "deferred_items": [],
  "tests": [],
  "smokes": [],
  "negative_tests": [],
  "modified_files": [],
  "architecture_changes": [],
  "security_changes": [],
  "data_model_changes": [],
  "old_rebuild_modified": false,
  "original_reference_modified": false,
  "secrets_detected": false,
  "next_stage_not_executed": true
}
```

可增加 task-specific fields。

---

# 22. COMPLETION CRITERIA

只有以下全部满足才能 COMPLETE：

1. Sole objective 完成。
2. 所有 REQUIRED outputs 存在。
3. 必需 tests PASS。
4. 必需 smoke PASS。
5. 必需 negative tests PASS。
6. 安全边界满足。
7. 数据/migration满足。
8. 不存在未解决的 required blocker。
9. 不存在未获决策却被自行实现的 PRODUCT_DECISION_REQUIRED。
10. old rebuild 未修改。
11. reference source 未修改。
12. 报告完整。
13. 未自动执行下一阶段。

任一核心条件不满足：

PARTIAL 或 FAIL。

---

# 23. FINAL CONSOLE SUMMARY

最终只需提供简洁 summary：

```text
SHEEP-XXX RESULT: COMPLETE | PARTIAL | FAIL | NOT_RUN

Phase:
Milestone:
Objective:

Required Outputs:
PASS | FAIL

Tests:
PASS | FAIL | NOT APPLICABLE

Smoke:
PASS | FAIL | NOT APPLICABLE

Negative Tests:
PASS | FAIL | NOT APPLICABLE

Security Boundary:
UNCHANGED | CHANGED

Data Model:
UNCHANGED | CHANGED

Old Rebuild Modified:
YES | NO

Original Reference Modified:
YES | NO

Decision Required:
YES | NO

Blockers:
<count>

Deferred:
<count>

Next Stage Executed:
NO
```

---

# 24. WHAT TO RETURN TO CONTROLLER

任务完成后，明确要求用户上传/贴回：

1. task report JSON
2. 关键测试/smoke summary
3. Decision Package（若有）
4. 失败日志（如果 PARTIAL/FAIL）

不要要求用户上传整个 workspace。

---

# 25. HARD STOP

任务结尾固定：

> **Do not start the next SHEEP task.**  
> **Wait for Controller PASS / REPAIR.**
