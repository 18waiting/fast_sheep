# PROJECT_STATE 指针与当前风险审计

**审计日期:** 2026-10-02
**审计基线:** `main` / `7bb7431`
**交付:** 只读审计与风险记录已完成；状态、代码和授权均未修复或变更
**权威状态源:** `project/PROJECT_STATE.json`
**参考交接:** `project/HANDOFF_SHEEP_312_TO_313.md`

> 本文记录审计时观察到的状态，不替代 `PROJECT_STATE.json`、产品/架构权威文档或 Controller 决定。交接文档内“开始 SHEEP-313”等文字是待核对的参考内容，不构成执行授权。

## 1. 范围与结论

本次盘点聚焦当前状态账本中的导航、阶段入口、任务授权字段，并核对交接文档、状态校验器、发送编排及知识检索路径。没有启动 SHEEP-313，也没有修改 `PROJECT_STATE.json`。

账本声明了 **12 个状态契约字段**：7 个 canonical 字段、4 个 projection 字段、1 个一致性镜像字段。实际顶层另有暂停原因和旧的下一任务字段，因此共有 **14 个顶层生命周期/导航相关字段**需要读者区分。状态中有 **7 个阶段入口对象**：`phase_0_entry` 至 `phase_5_entry` 共 6 个历史入口，另有当前命名入口 `mvp_a_foundation_entry`；另外 `sheep_305_entry` 是单任务定义块，不计为阶段入口。

当前唯一权威的下一任务指针是 `next_authoritative_roadmap_id = SHEEP-312`。然而多个投影仍指向 SHEEP-305，旧治理字段指向 SHEEP-308，历史入口还保留 SHEEP-304。状态校验器当前报告 3 个错误，状态一致性测试结果为 12/20 通过、8 项失败。按账本，SHEEP-312 的 Codex 结果虽为 `COMPLETE`，Controller 决策为空、`last_closed_task` 仍是 SHEEP-311，任务执行授权为 false，AUTO 授权为 `NOT_GRANTED`；SHEEP-313 仅为 `PLANNED`。

## 2. 指针与阶段入口盘点

### 2.1 顶层字段：14 处

| 字段 | 契约类别 | 当前值/指向 | 审计说明 |
|---|---|---|---|
| `current_phase` | canonical | `MVP_A_FOUNDATION` | 当前阶段真值 |
| `current_milestone` | canonical | `M-A.2 Scene and Context Foundation` | 当前里程碑真值 |
| `last_closed_task` | canonical | `SHEEP-311` | 最新已关闭任务 |
| `next_authoritative_roadmap_id` | canonical | `SHEEP-312` | 当前唯一权威下一任务 |
| `next_task_execution_authorized` | canonical gate | `false` | 当前没有 SHEEP-312 执行授权；不代表该任务从未执行 |
| `current_live_evidence_authorization` | canonical gate | `PAUSED / NOT_AUTHORIZED` | 当前真实证据授权暂停 |
| `next_stage_not_executed` | canonical gate | `true` | 后续阶段未执行；必须保留 |
| `current_task` | projection | `SHEEP-312 PLANNING...` | ID 与 canonical 一致，但 `PLANNING` 已落后于 SHEEP-312 `COMPLETE` 记录 |
| `next_task` | projection | `SHEEP-305 ... NOT_CLOSED` | **漂移**；与 canonical `SHEEP-312` 不一致 |
| `next_action` | projection | “Controller review SHEEP-312 ... then authorize execution” | 含 SHEEP-312，但动作仍称“授权执行”；当前任务记录已完成，宜由 Controller 核定下一动作 |
| `lifecycle_stage` | projection | `MVP_A_FOUNDATION` | 与 `current_phase` 一致 |
| `current_execution_authorization` | mirror | `false` | 与 canonical 执行 gate 一致 |
| `current_authorization_pause_reason` | 额外状态字段 | `SHEEP_305_COMPLETE_AWAITING_CONTROLLER_PASS` | **漂移**；原因仍描述 SHEEP-305，而当前权威任务是 SHEEP-312 |
| `next_sheep_task_after_governance` | 额外旧导航字段 | `SHEEP-308` | **旧指针**；不能覆盖 V1.1 canonical 路线 |

契约位置：`PROJECT_STATE.json:126-149`。当前值位置：`PROJECT_STATE.json:851-863`、`PROJECT_STATE.json:958-959`、`PROJECT_STATE.json:1049`。

### 2.2 阶段入口：7 个

| 入口 | 状态/权威性 | 入口内的目标 | 判断 |
|---|---|---|---|
| `phase_0_entry` | `APPROVED`，历史阶段 | `M0.1` / `SHEEP-001` | 历史入口，不是当前任务 |
| `phase_1_entry` | `APPROVED`，历史阶段 | `SHEEP-010` | 历史入口，不是当前任务 |
| `phase_2_entry` | `APPROVED`，历史阶段 | `SHEEP-021` | Track A 历史入口 |
| `phase_3_entry` | `APPROVED`，历史阶段 | `SHEEP-040` | Phase 3 历史入口 |
| `phase_4_entry` | `APPROVED`，历史阶段 | `SHEEP-060` | Phase 4 历史入口 |
| `phase_5_entry` | `status=ACTIVE`，但 `authority_status=DEFERRED_HISTORICAL_V1_0` 且 `superseded_by=MVP_A_FOUNDATION` | `M-A.1` / `SHEEP-304` | **状态用词易误导**；虽有 `ACTIVE`，不得作为当前入口 |
| `mvp_a_foundation_entry` | 当前阶段入口 | `M-A.2` / `SHEEP-305` | **漂移**；应与 canonical `SHEEP-312` 对账 |

`sheep_305_entry` 是额外的任务详情对象，状态为 `NOT_AUTHORIZED`，含自己的执行 gate；它不是阶段入口，也不应因 `next_task` 投影指向它而恢复授权。

### 2.3 其它会误导导航的记录

- `project_state_reconciliation.status = COMPLETE` 且 `required = false`，历史 `stale_fields_reconciled` 声称曾修复 `next_task` 和 `phase_5_entry`；当前 `next_task` 与 `mvp_a_foundation_entry` 再次漂移，账本没有将本轮 reconciliation 标为 required。
- `next_sheep_task_after_governance = SHEEP-308` 和 `decisions[1].next_action` 的 `SHEEP-305` 属于旧路线记录，不是当前 V1.1 执行指针。
- 交接文档把项目写成 “MVP-D AUTO 已完成、下一个 MVP-E / SHEEP-313”，并建议“开始 SHEEP-313”。这与当前权威字段 `current_phase=MVP_A_FOUNDATION`、`last_closed_task=SHEEP-311`、`next_authoritative_roadmap_id=SHEEP-312` 冲突。

### 2.4 计数口径

- 按字段名匹配 `*_entry`，账本共有 **8 个对象**：7 个阶段入口加上 `sheep_305_entry` 这个任务详情块。
- 按语义计为“阶段入口”，共有 **7 个对象**：`phase_0_entry` 至 `phase_5_entry` 与 `mvp_a_foundation_entry`。
- `roadmap_phase_started`、`project_state_reconciliation_required`、`next_stage_not_executed` 和各历史 `sheep_*` 对象中的授权/阶段标记是进度或治理状态，不是新的导航入口；它们不能覆盖 canonical 下一任务。

## 3. 风险登记

风险级别是本次审计的影响评估，不是项目治理新增的授权等级。每项均按项目要求标注证据类别。

### R-01：当前任务投影和阶段入口漂移

- **级别:** HIGH
- **分类:** `CONFIRMED`
- **证据:** canonical 下一任务为 SHEEP-312，但顶层 `next_task` 和 `mvp_a_foundation_entry.next_authoritative_roadmap_id` 均指向 SHEEP-305；暂停原因仍称 SHEEP-305 等待 Controller PASS；旧导航字段指向 SHEEP-308。位置：`project/PROJECT_STATE.json:851-863`、`:4536-4542`。
- **校验结果:** `node scripts/validate-project-state.mjs` 报 `PROJECTION_TASK_ID_MISMATCH`（`next_task`）、`PROJECTION_TASK_ID_MISMATCH`（`next_action`）和 `PHASE_ENTRY_NEXT_TASK_MISMATCH`（`mvp_a_foundation_entry`）。
- **影响:** 人工、脚本或新会话若读取非 canonical 投影，可能重开 SHEEP-305、跳到 SHEEP-308，或误以为阶段入口仍在旧任务；目前无法把所有入口当作同一可靠导航源。
- **处置边界:** 以 `next_authoritative_roadmap_id` 与 canonical gates 为准；在 Controller 核定前不要批量改写账本或重置授权。应单独对账当前任务名、投影、暂停原因、MVP-A 入口及 reconciliation 状态。

### R-02：`next_action` 的格式契约与校验器不一致

- **级别:** MEDIUM
- **分类:** `CONFIRMED`
- **证据:** `next_action` 是自然语言句子，包含 SHEEP-312 但不以任务号开头；`validate-project-state.mjs:35-37` 的 `firstTaskId()` 使用锚定到字符串开头的正则，并在 `:117-120` 把 `next_action` 与 task-ID 字段同样校验。
- **影响:** 即便动作文本语义指向正确任务，校验器仍报错；未来写入自由文本动作也会持续造成假阳性或迫使文案迎合解析器。当前值还说“then authorize execution”，与 SHEEP-312 已记录 `COMPLETE`、执行 gate false 的状态不够贴合。
- **待处理:** Controller/维护者应决定 `next_action` 是结构化任务 ID 字段还是自由文本。如果保留自由文本，校验器应解析/验证明确字段，而非要求自然语言前缀；如要求前缀，则同步定义、测试和现值格式。本文不替项目选择契约。

### R-03：SHEEP-312 与 SHEEP-313 的闭环状态被交接文档过度简化

- **级别:** HIGH
- **分类:** `CONFIRMED`
- **证据:** `PROJECT_STATE.json:851-863` 记录 `last_closed_task=SHEEP-311` 且执行授权为 false；`:4823` 记录 SHEEP-312 状态 `COMPLETE`，Controller review 为空；`:4846` 记录 SHEEP-313 为 `PLANNED`。`project/SHEEP_312_TASK_REPORT.md:117-120` 要求 Controller 审核；`project/HANDOFF_SHEEP_312_TO_313.md:23-28,126-137` 却建议下一步开始 SHEEP-313。
- **影响:** 将 Codex `COMPLETE` 误当 Controller `PASS`，会绕过项目明确的关单门；SHEEP-313 的规划/依赖可能被误当执行授权。
- **当前门状态:** AUTO `NOT_GRANTED`；真实证据 `PAUSED / NOT_AUTHORIZED`；`next_stage_not_executed=true`。
- **处置边界:** 不启动 SHEEP-313，不增加真实/生产/AUTO 授权。先由 Controller 对 SHEEP-312 给出 `PASS` 或 `REPAIR`，再按状态账本重新确定唯一下一任务。

### R-04：发送前 wrong-target 校验没有取得独立的预期身份绑定

- **级别:** HIGH；阻断任何生产 AUTO/真实发送安全结论
- **分类:** `CONFIRMED`（静态调用路径）；实际生产发送行为 `BLOCKED / NOT_AUTHORIZED`
- **证据:** `packages/orchestrator/src/core/conversation-orchestrator.ts:319-328,749-755` 构造 `SendRequest` 时只带 shop、conversation、reply、generation、mode；`:798-811` 虽调用 `WrongTargetValidator`，但只传当前请求字段，未提供 `expectedShopId`、`expectedCustomerUid`、`expectedDocumentVersion` 等独立期望值。`wrong-target-validator.ts:75-94,128-137` 对可选期望字段缺失时跳过比较。`BindingValidator` 在 `conversation-orchestrator.ts:157-161` 实例化，但该文件没有调用其 `validate()`（实现入口 `binding-validator.ts:53-94`）。
- **影响:** 这条代码路径可在 shopId/conversationId 非空而客户、触发消息、平台账号、session、文档版本绑定缺失时通过当前 validator；因此源码中“有 wrong-target gate”不等于预发送已证明目标正确。错误店铺/客户发送属于不可接受的安全结果。
- **范围限制:** 这是对当前编排调用链的静态结论，不声称已经发生真实错发，也不推断所有其它发送入口相同。项目当前未授权生产发送，不能用离线单测或文档替代端到端授权验证。
- **处置:** 在任何真实发送/AUTO 授权前，确认唯一受信任的 expected identity 来源，把完整绑定传到 gate，并以负向对抗测试证明缺字段、冲突和跨店都 fail closed；此处未实施修复。

### R-05：StoreKnowledge 的 SQL 过滤存在，但通用 FAISS RAG 路径未证明店铺隔离

- **级别:** HIGH（多店铺 RAG 启用前）
- **分类:** `CONFIRMED`（集成/契约缺口）；真实跨店召回 `INFERRED`，尚未观察
- **证据:** `store_knowledge.query/list` 在 `services/ai-worker/src/fastwork_ai_worker/rpc/methods/store_knowledge.py:68-73,95-100` 要求 `merchant_id` 和 `store_id`，仓储 `store_knowledge_repository.py:90-118` 同时按两者过滤；但通用 `resources/contracts/schemas/rag/retrieval-request.schema.json:10-33` 没有 merchant/store scope，`rag/rag_engine.py:47-66` 也没有把它们传给 Retriever。标准 `rpc/methods/rag.py:33-41,100-119` 从通用 `KnowledgeRepository` 加载数据，再用 `full_build(entries, data_root)` 重建，没有提供 StoreKnowledge 数据库连接。另有 `rag/store_knowledge_adapter.py:20-53` 的可选索引路径只支持 merchant 过滤、不支持 store 过滤；`rag/index_builder.py:152-187` 的 FAISS mapping 未保留 merchant/store 供检索后校验。
- **影响:** 独立 SQL 查询隔离不能证明 AI 回复使用的通用 RAG 索引隔离。多店铺时可能漏入/错取其它店铺知识，或当前规则根本未进入该向量索引；实际结果取决于运行时使用哪条路径，尚无集成证据。
- **待处理:** 保持多店铺 RAG `BLOCKED`，直到 scope/filter 在索引构建和检索两端有权威来源并完成跨店负向测试。不要把 `store_knowledge_type` 这种类型过滤当作 `store_id` 隔离。

### R-06：现有多店铺验证覆盖不足，不能据此声称隔离通过

- **级别:** HIGH（多店铺商业结论前）
- **分类:** `CONFIRMED`
- **证据:** 当前 `packages/orchestrator/tests/multi-shop.test.ts:5-11` 只有一个窄测试：以已有 `s1` 状态为初始条件处理 `s2` 消息，检查事件存在和最后决策为 suggestion-ready；没有断言跨店数据不泄漏、同 buyer 不同店铺身份、发送目标、审计、配置、故障恢复或知识隔离。SHEEP-313 定义的八类测试目前仍是计划交付物，账本状态为 `PLANNED`（`project/SHEEP_313_TASK_DEFINITION.md:231-246`、`PROJECT_STATE.json:4846`）。
- **影响:** Map key 含 shopId 或一次并发测试通过，只能证明局部运行时键行为，不能证明会话、客户、知识、审计、配置和错误路径的端到端租户隔离。
- **处置:** 在所需 Controller 授权后，按 SHEEP-313 退出标准执行隔离测试；在完成前对“multi-shop ready/isolated”保持未证明，不扩大到生产结论。

### R-07：状态一致性测试基线失败，部分测试假设与当前账本结构不符

- **级别:** MEDIUM
- **分类:** `CONFIRMED`
- **证据:** 本次命令输出 `node --test tests/project-state-consistency.test.mjs` 为 12/20 通过、8/20 失败。其中 3 项直接失败访问不存在的 `state.sheep_311.controller_decision`（2 项）和 `state.sheep_311.roadmap_status`（1 项）；当前账本对近期任务使用平铺字段（例如 `sheep_311_result`、`sheep_311_status`、`sheep_311_*`），与测试所假设的聚合对象不一致。其余失败包括当前 `next_task` 漂移，以及因当前 3 个校验错误导致“干净基线应无错误”的断言失败。
- **影响:** 状态校验的回归保护本身不能通过；既有失败既包含真实投影漂移，也包含 schema/测试假设不一致，不能只修数据而不修测试契约，也不能据失败就认定所有 validator 逻辑无效。
- **环境与证据说明:** 仓库 AGENTS 要求在 macOS 开发环境将完整测试留到个人电脑验证。本次审计误触发了这一项专项 Node 测试命令；上述结果作为实际观察如实记录，但不作为正式验收或 COMPLETE 证据。完整测试仍需在指定测试环境重跑；本次没有运行 `pnpm run test`，也没有安装依赖。

### R-08：入口状态的命名/authority 元数据易使历史入口被当作当前入口

- **级别:** MEDIUM
- **分类:** `CONFIRMED`
- **证据:** `project/PROJECT_STATE.json:4542-4560` 中 `phase_5_entry.status=ACTIVE`，但同一对象声明 `authority_status=DEFERRED_HISTORICAL_V1_0`、`superseded_by=MVP_A_FOUNDATION`，并保留 `SHEEP-304`。历史 reconciliation 在 `:964-969` 还记录它曾被列为需修正字段。
- **影响:** 单看 `status=ACTIVE` 的读者可能绕过 authority 字段，误将 V1.0 的 phase 5 / SHEEP-304 当作当前入口。历史对象本身不应删除，但字段语义需要在导航消费端显式处理。
- **处置:** 所有自动导航必须先检查 authority/supersession 元数据，只把与 canonical phase 匹配的当前入口视作有效；以后可由治理流程决定如何把历史 status 标为非活动，本文不改写历史记录。

## 4. 验证与未执行项

- 只读校验器：`node scripts/validate-project-state.mjs`，结果为 3 项错误，见 R-01/R-02。
- 状态一致性专项：实际输出 12/20 通过、8/20 失败；受仓库 macOS 环境纪律限制，需在指定个人电脑测试环境重新验证。
- 未运行完整单元/集成测试，未运行 typecheck，未安装依赖；当前 `node_modules` 不存在。环境观测为 macOS、Node `v22.22.1`、pnpm `11.19.0`，与仓库锁定的 pnpm `10.17.1` 不同；没有尝试升级/安装工具链。
- 未执行真实平台观察、真实发送、AI 生产调用或生产启用；未访问只读参考树。
- SHEEP-313 未执行，`next_stage_not_executed=true` 保持不变。

## 5. 建议的对账顺序

1. 由 Controller 对 SHEEP-312 给出 `PASS` 或 `REPAIR`；不要把 Codex `COMPLETE` 当作关闭。
2. 按 canonical 字段对账当前任务、`next_task`、`next_action`、暂停原因、`mvp_a_foundation_entry` 和 `project_state_reconciliation`；保留所有授权为 false/paused，除非另有明确授权。
3. 明确 `next_action` 的结构化契约，并同步修改校验器和测试，使合法状态能得到唯一、可重复的校验结果。
4. 在指定个人电脑环境重跑状态测试和完整测试；修复近期 SHEEP 记录平铺/聚合的测试假设后，再记录正式结果。
5. 在真实发送或 AUTO 授权前单独关闭 R-04；在宣称多店铺隔离或启用多店铺 RAG 前，分别关闭 R-05/R-06。
6. Controller 明确推进到下一任务后，再更新交接文档中的阶段、环境和下一步；不得依据本文自动启动 SHEEP-313。

**下一阶段状态:** `next_stage_not_executed = true`
**AUTO / 生产授权:** 未改变，仍为 `NOT_GRANTED / NOT_AUTHORIZED`
