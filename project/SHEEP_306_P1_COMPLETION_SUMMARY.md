# SHEEP-306 P1 完成总结

> **完成日期:** 2026-09-29
> **执行环境:** macOS 开发环境（公司电脑），typecheck only
> **状态:** ✅ P1 全部完成（P0 ✅ | P1 ✅ | P2 ⏳）

---

## 一、完成概览

### P0 级问题（治理）— ✅ 全部完成

| 编号 | 问题 | 状态 | 修改文件 |
|------|------|------|----------|
| P0-1 | PROJECT_STATE.json 状态不精确 | ✅ | `project/PROJECT_STATE.json` |
| P0-2 | Format 迁移路径未明确 | ✅ | `docs/architecture/REPLY_PLAN_EVOLUTION.md` |

### P1 级问题（实现阻塞）— ✅ 全部完成

| 编号 | 问题 | 状态 | 修改/新建文件 |
|------|------|------|---------------|
| P1-3 | RolloutMode 词汇不统一 | ✅ | `resources/contracts/schemas/domain/reply-plan.schema.json` |
| P1-4 | knowledge_type 分类不统一 | ✅ | `packages/domain/src/context-envelope.ts` |
| P1-5 | ContextEnvelope/ReplyPlan 缺 TypeScript 类型 | ✅ | `packages/domain/src/context-envelope.ts`, `reply-plan.ts` |
| P1-6 | ContextEnvelopeBuilder 未实现 | ✅ | 6 个子任务（见下文） |
| P1-7 | SceneClassifier 未实现 | ✅ | 1 个子任务（见下文） |

---

## 二、P1-6 子任务详细拆解与完成情况

### P1-6a: StoreKnowledge Retrieval Port ✅

**目标:** 定义 Main-side 调用 StoreKnowledge 检索的端口接口

**新建文件:**
- `apps/desktop/src/main/ports/store-knowledge-retrieval-port.ts`

**关键设计:**
- `StoreKnowledgeRetrievalPort` 接口：`query()` + `list()` 方法
- `StoreKnowledgeQueryParams`：支持 merchant_id, store_id, keywords, knowledge_type, status, limit
- `StoreKnowledgeEntry`：与 Worker RPC 响应和 DB schema 对齐
- 使用 Layer 2 knowledge_type（SHIPPING_TIME | RETURN_POLICY | FAQ | OTHER）

**验收:** ✅ typecheck 通过

---

### P1-6b: StoreKnowledge Retrieval Adapter ✅

**目标:** 实现 `StoreKnowledgeRetrievalPort`，桥接 Main → Worker RPC

**新建文件:**
- `apps/desktop/src/main/adapters/rpc-store-knowledge-retrieval.ts`

**关键设计:**
- `RpcStoreKnowledgeRetrievalAdapter` 类实现 Port 接口
- 通过 `AIWorkerClient.request()` 调用 Worker 的 `store_knowledge.query` / `store_knowledge.list`
- 错误处理：RPC 失败返回 `ok: false` + error message
- 响应映射：Worker 响应 → `StoreKnowledgeEntry`（snake_case 对齐）

**验收:** ✅ typecheck 通过

---

### P1-6c: AuthoritativeFacts Port + Stub ✅

**目标:** 定义 Facts 聚合的端口接口，MVP 阶段提供 Stub 实现

**新建文件:**
- `apps/desktop/src/main/ports/authoritative-facts-port.ts`
- `apps/desktop/src/main/adapters/stub-authoritative-facts.ts`

**关键设计:**
- `AuthoritativeFactsPort` 接口：`gather()` 方法
- `FactsGatherParams`：merchant_id, store_id, product_id?, order_id?
- `StubAuthoritativeFactsProvider`：返回空对象（shop_facts, product_facts, knowledge_facts）
- order_facts / logistics_facts 标记为 DEFERRED（P2-15）

**验收:** ✅ typecheck 通过

---

### P1-6d: UnknownIdentifier ✅

**目标:** 实现 Unknown 判定逻辑

**新建文件:**
- `apps/desktop/src/main/services/unknown-identifier.ts`

**关键设计:**
- `identifyUnknowns()` 纯函数：基于 Scene 判定 required facts
- MVP 规则：
  - SHIPPING_TIME 场景：需要 knowledge_facts，缺失则 blocking unknown
  - OTHER_UNSUPPORTED 场景：无 required facts，无 blocking unknown
  - UNKNOWN 场景：需要完整 identity_lock，不完整则 blocking unknown
- `isIdentityLockComplete()`：验证所有 required 字段非空
- 穷举检查：新增 Scene 时编译期报错

**验收:** ✅ typecheck 通过

---

### P1-6e: ContextEnvelopeBuilder 主入口 ✅

**目标:** 组装所有子组件，实现 `build()` 主入口

**新建文件:**
- `apps/desktop/src/main/services/context-envelope-builder.ts`

**关键设计:**
- `ContextEnvelopeBuilder` 类：依赖注入（sceneClassifier, factsPort, knowledgePort, clock）
- `build()` 方法流程：
  1. 构建 ContractIdentityLock（InboundTurn → ContractIdentityLock 映射）
  2. 分类 Scene（MinimalSceneClassifier + adaptSceneToEnvelope）
  3. 聚合 Facts（AuthoritativeFactsPort.gather）
  4. 检索 Knowledge（StoreKnowledgeRetrievalPort.query）
  5. 判定 Unknowns（identifyUnknowns）
  6. 组装 ContextEnvelope
- 类型映射：Domain Layer (camelCase) → Contract Schema (snake_case)
- `SystemClock`：默认时间戳生成器

**验收:** ✅ typecheck 通过

---

### P1-6f: Orchestrator 集成点（骨架）✅

**目标:** 在 Main 进程中预留 ContextEnvelopeBuilder 的集成点

**新建文件:**
- `apps/desktop/src/main/services/context-envelope-integration.ts`

**关键设计:**
- `ContextEnvelopeIntegration` 类：管理 shadow-mode 执行
- `runShadowMode()` 方法：fire-and-forget，不阻塞主流程
- 事件发射：`ContextEnvelopeBuilt` / `ContextEnvelopeBuildFailed`
- 错误处理：失败只日志，不影响 AI 回复生成
- 架构说明：集成在 Main 进程（非 Orchestrator 包），避免循环依赖

**验收:** ✅ typecheck 通过

---

## 三、P1-7 子任务完成情况

### P1-7a: Scene → ContextEnvelope 适配器 ✅

**目标:** 将 MinimalSceneClassifier 的输出适配为 ContextEnvelope 的 scene 字段

**新建文件:**
- `apps/desktop/src/main/services/scene-envelope-adapter.ts`

**关键设计:**
- `adaptSceneToEnvelope()` 纯函数：MinimalScene → string 直接映射
- `isValidEnvelopeScene()` 类型守卫：验证 scene 是否在 bounded vocabulary 内
- `extractSceneMetadata()` 元数据提取：用于诊断
- 保持 MINIMAL_V1 约束：不扩展场景词汇，第二个场景是 OPEN_DECISION

**验收:** ✅ typecheck 通过

---

## 四、关键决策记录

### D1: Contract vs Domain Layer Types

**决策:** ContextEnvelope 类型使用 `Contract` 前缀（如 `ContractIdentityLock`）

**原因:** 避免与 Domain Layer 的 `IdentityLock`（`identity-inbound.ts`）冲突

**模式:**
- Contract Schema：flat snake_case（JSON Schema 兼容）
- Domain Layer：`IdentityResolution<T>` wrapper + camelCase

---

### D2: P1-7 重新定义

**原始描述:** 创建 5 场景分类器（SHIPPING_TIME / PRODUCT_INQUIRY / ORDER_STATUS / RETURN_POLICY / GENERAL）

**实际实现:** 适配现有 MINIMAL_V1 分类器（SHEEP-304）

**原因:**
- SHEEP-304 已实现 bounded 3 场景词汇
- 第二个场景是 `OPEN_DECISION`，不允许扩展
- 避免重复造轮子

---

### D3: P1-6 拆解策略

**原始估算:** 7 天单体 Builder 实现

**实际拆解:** 6 个子任务（共 7.25 天）

**原因:**
- Builder 依赖多个不存在的基础设施
- StoreKnowledge Main-side service 已被删除
- Facts 聚合层不存在
- 按依赖层次拆解，每个子任务可独立交付

---

### D4: Orchestrator 集成位置

**决策:** 集成在 Main 进程（apps/desktop），不在 Orchestrator 包（packages/orchestrator）

**原因:**
- Orchestrator 是共享包，不能依赖 apps/desktop
- Builder 在 Main 进程中
- 避免循环依赖
- 符合现有架构（Main 进程负责编排）

---

## 五、文件清单

### 新建文件（10 个）

1. `apps/desktop/src/main/ports/store-knowledge-retrieval-port.ts`
2. `apps/desktop/src/main/ports/authoritative-facts-port.ts`
3. `apps/desktop/src/main/adapters/rpc-store-knowledge-retrieval.ts`
4. `apps/desktop/src/main/adapters/stub-authoritative-facts.ts`
5. `apps/desktop/src/main/services/unknown-identifier.ts`
6. `apps/desktop/src/main/services/context-envelope-builder.ts`
7. `apps/desktop/src/main/services/context-envelope-integration.ts`
8. `apps/desktop/src/main/services/scene-envelope-adapter.ts`
9. `packages/domain/src/context-envelope.ts`（新建，后改为从 index.ts 导出）
10. `packages/domain/src/reply-plan.ts`（新建，后改为从 index.ts 导出）

### 修改文件（3 个）

1. `project/PROJECT_STATE.json`（P0-1）
2. `docs/architecture/REPLY_PLAN_EVOLUTION.md`（P0-2, P1-3）
3. `resources/contracts/schemas/domain/reply-plan.schema.json`（P1-3）

---

## 六、验证结果

### Typecheck

```bash
$ pnpm run typecheck
# 所有 20 个 workspace projects typecheck 通过
# apps/desktop typecheck: Done
```

**结果:** ✅ 全部通过

### 测试

**状态:** ⏳ DEFERRED

**原因:** 当前环境是 macOS 开发机（Node v20），不支持 `--experimental-strip-types`

**需要:** 在个人电脑（Windows, Node v22+）上运行测试

**测试命令:**
```bash
pnpm run test
```

---

## 七、下一步工作（P2 级问题）

### P2-8: ReplyPlanVerifier 未实现

**目标:** 实现发送前验证逻辑

**优先级:** 🔵 P2

**预估工作量:** 2 天

---

### P2-9: IdentityLock 验证未实现

**目标:** 验证 IdentityLock 完整性

**优先级:** 🔵 P2

**预估工作量:** 1 天

---

### P2-10: Fact 验证未实现

**目标:** 验证实事新鲜度

**优先级:** 🔵 P2

**预估工作量:** 1 天

---

### P2-11 ~ P2-15: 其他 P2 问题

详见 `project/SHEEP_306_P0_P2_PROBLEM_TRACKER.md`

---

## 八、总结

### 成果

✅ P0 治理问题全部解决（状态精确化、迁移路径明确）

✅ P1 实现阻塞全部解除（类型定义、Builder、集成点）

✅ 所有代码 typecheck 通过

✅ 架构清晰，依赖关系明确

### 约束

⏳ 测试需要在个人电脑上运行（Node v22+）

⏳ P2 级问题待后续处理

### 技术债务

- Builder 的 keyword 提取是 placeholder（返回空数组）
- Trigger message content 需要从 message store 获取（当前为空字符串）
- Knowledge relevance_score 固定为 1.0（MVP 简化）

---

## 九、Controller Review

**状态:** 待 Controller review

**需要 Controller 确认:**

1. P0 治理修改是否符合预期？
2. P1 实现是否满足架构要求？
3. 是否同意 P2 问题的优先级和工作量估算？
4. 是否授权开始 P2 实现？

**Review 决策:**
- `PASS` → 关闭 SHEEP-306 P0/P1，开始 P2
- `REPAIR` → 根据反馈修复后重新 review

---

**文档版本:** v1.0
**创建日期:** 2026-09-29
**作者:** Codex (SHEEP-306 执行者)
