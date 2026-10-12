# SHEEP-306 P1 任务详细拆解

> **创建日期:** 2026-09-29
> **目的:** 将 P1-6 和 P1-7 拆解为可独立交付的子任务
> **原则:** 每个子任务有明确的目标、边界、验收标准、依赖关系

---

## 〇、关键发现（代码考古结论）

在拆解之前，必须先澄清几个**关键事实**，避免重复造轮子或方向偏差：

### 发现 1: SceneClassifier 已存在（MINIMAL_V1）

- **文件:** `apps/desktop/src/main/services/minimal-scene-classifier.ts`
- **SHEEP:** SHEEP-304 实现
- **场景词汇:** `SHIPPING_TIME | OTHER_UNSUPPORTED | UNKNOWN`（**不是** P1-7 描述的 5 场景）
- **分类方式:** 基于规则（`SceneRule`），确定性，无 AI
- **集成状态:** 与 `InboundTurn` 集成，**不与 ContextEnvelope 集成**
- **关键约束:** 第二个场景是 `OPEN_DECISION`，不允许扩展词汇

### 发现 2: StoreKnowledge Main-side service 已被删除

- commit `0bbd6ad` 删除了 `apps/desktop/src/main/services/store-knowledge-service.ts`（315 行 dead code）
- **当前状态:** Main 侧**没有** StoreKnowledge 服务
- **Worker 侧:** Python 端有完整的 StoreKnowledge 实现（Repository + RPC + RAG 集成）

### 发现 3: AuthoritativeFacts 没有 Main-side 聚合层

- `shop_facts`、`product_facts`、`order_facts`、`logistics_facts` 在 Main 侧**没有聚合代码**
- 现有 Repository 都是 Legacy 格式（`ShopRecord`、`ProductRecord`），不是 `ProvenancedFact`
- Worker 侧有 `OrderContextProvider`（但是 mock）

### 发现 4: Format A → C 的桥接层不存在

- Orchestrator 通过 `WorkerAiEngineClient` 发送 `GenerateReplyInput`（Format A 变体）
- Worker 侧 `ConversationEngine.generate()` 接收 `ConversationEngineRequest`（Format A）
- **ContextEnvelope（Format C）没有任何消费者**

---

## 一、P1-7 重新定义：SceneClassifier 适配层

### 原始描述的问题

P1-7 原始描述提议创建 5 个场景的 SceneClassifier（SHIPPING_TIME / PRODUCT_INQUIRY / ORDER_STATUS / RETURN_POLICY / GENERAL），但这**与 SHEEP-304 的 MINIMAL_V1 冲突**：

- MINIMAL_V1 词汇是**有界的**（3 个场景）
- 第二个场景是 `OPEN_DECISION`（不允许扩展）
- SHEEP-304 明确禁止建立广泛的意图分类体系

### 正确理解

P1-7 不是"创建 SceneClassifier"（已存在），而是**创建适配层**，将 MINIMAL_V1 的 `SceneClassification` 转换为 ContextEnvelope 的 `scene` 字段。

---

### P1-7a: Scene → ContextEnvelope 适配器

**目标:** 将 `MinimalSceneClassifier` 的输出适配为 ContextEnvelope 可消费的 `scene` 字段

**边界:**
- ✅ 创建纯函数适配器（`SceneClassification` → `string`）
- ✅ 保持 MINIMAL_V1 词汇不变
- ✅ 保持 `OPEN_DECISION` 约束
- ❌ 不修改 `minimal-scene-classifier.ts`
- ❌ 不扩展场景词汇
- ❌ 不引入 AI 分类

**输入:**
```typescript
import type { SceneClassification } from "./minimal-scene-classifier.js";
```

**输出:**
```typescript
// scene 值直接映射：SHIPPING_TIME → "SHIPPING_TIME", 
// OTHER_UNSUPPORTED → "OTHER_UNSUPPORTED", UNKNOWN → "UNKNOWN"
function adaptScene(classification: SceneClassification): string;
```

**文件:** `apps/desktop/src/main/services/scene-envelope-adapter.ts`（新建）

**工作量:** 0.25 天

**验收标准:**
- [ ] 纯函数，无副作用
- [ ] 映射覆盖所有 3 个 MinimalScene 值
- [ ] typecheck 通过
- [ ] 单元测试通过（需在个人电脑运行）

**依赖:** 无

---

## 二、P1-6 拆解：ContextEnvelopeBuilder

### 原始 7 天估算的问题

原始估算把 Builder 当作一个整体，但实际上它依赖多个**尚未存在的基础设施**：
1. Main-side StoreKnowledge 服务（已被删除）
2. Facts 聚合层（不存在）
3. Worker RPC 调用 StoreKnowledge（存在但未集成到 Main）
4. Unknown 判定逻辑（依赖 Scene）

### 拆解策略

将 Builder 按**依赖层次**拆解为 6 个子任务，每个子任务可独立交付和验证。

---

### P1-6a: StoreKnowledge Retrieval Port（Main-side）

**目标:** 定义 Main-side 调用 StoreKnowledge 检索的端口接口

**背景:**
- Main 侧需要检索 StoreKnowledge 来填充 `retrieved_knowledge`
- Worker 侧已有 `store_knowledge.query` RPC 方法
- Main 需要通过 RPC 桥调用 Worker 的检索能力
- 或者 Main 直接读 SQLite（共享数据库）

**边界:**
- ✅ 定义 Port 接口（`StoreKnowledgeRetrievalPort`）
- ✅ 定义输入/输出类型
- ✅ 不实现具体检索逻辑（P1-6b 实现）
- ❌ 不修改 Worker 侧代码
- ❌ 不修改数据库 schema

**接口设计:**
```typescript
// Port 定义
export interface StoreKnowledgeRetrievalPort {
  query(params: StoreKnowledgeQueryParams): Promise<StoreKnowledgeQueryResult>;
}

export interface StoreKnowledgeQueryParams {
  readonly merchant_id: string;
  readonly store_id: string;
  readonly keywords?: string[];
  readonly knowledge_type?: KnowledgeType;        // Layer 1
  readonly store_knowledge_type?: StoreKnowledgeType; // Layer 2
  readonly status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  readonly limit?: number;
}

export interface StoreKnowledgeQueryResult {
  readonly entries: readonly StoreKnowledgeEntry[];
}

export interface StoreKnowledgeEntry {
  readonly id: string;
  readonly merchant_id: string;
  readonly store_id: string;
  readonly knowledge_type: KnowledgeType;
  readonly store_knowledge_type?: StoreKnowledgeType;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly relevance_score?: number;
}
```

**文件:** `apps/desktop/src/main/ports/store-knowledge-retrieval-port.ts`（新建）

**工作量:** 0.5 天

**验收标准:**
- [ ] Port 接口定义完整
- [ ] 类型与 JSON Schema 一致
- [ ] typecheck 通过

**依赖:** P1-5（TypeScript 类型）

---

### P1-6b: StoreKnowledge Retrieval Adapter（实现）

**目标:** 实现 `StoreKnowledgeRetrievalPort`，桥接 Main → Worker RPC

**实现策略选择:**

**选项 A: RPC 桥接**
- Main 通过现有 RPC 机制调用 Worker 的 `store_knowledge.query`
- 优点：复用现有代码，职责分离
- 缺点：需要 RPC 桥基础设施

**选项 B: 共享 SQLite 直读**
- Main 直接读取 Worker 可见的同一个 SQLite 数据库
- 优点：简单，无 RPC 开销
- 缺点：跨进程读同一数据库可能有锁问题

**推荐: 选项 A（RPC 桥接）**，与现有架构一致

**边界:**
- ✅ 实现 `StoreKnowledgeRetrievalPort`
- ✅ 通过 RPC 调用 Worker
- ✅ 将 Worker 响应映射为 `StoreKnowledgeEntry`
- ❌ 不修改 Worker 侧 RPC 方法
- ❌ 不实现向量检索（Phase 9）

**文件:** `apps/desktop/src/main/adapters/rpc-store-knowledge-retrieval.ts`（新建）

**工作量:** 1 天

**验收标准:**
- [ ] 实现 `StoreKnowledgeRetrievalPort`
- [ ] RPC 调用正确传递参数
- [ ] 响应正确映射为 `StoreKnowledgeEntry`
- [ ] typecheck 通过
- [ ] 单元测试通过（需在个人电脑运行，mock RPC）

**依赖:** P1-6a

---

### P1-6c: AuthoritativeFacts Port + Stub

**目标:** 定义 Facts 聚合的端口接口，MVP 阶段提供 Stub 实现

**背景:**
- `AuthoritativeFacts` 包含 shop_facts / product_facts / order_facts / logistics_facts / knowledge_facts
- MVP 阶段只有 `knowledge_facts`（来自 StoreKnowledge）
- `shop_facts` / `product_facts` 需要后续任务实现
- `order_facts` / `logistics_facts` 已 DEFERRED（P2-15）

**边界:**
- ✅ 定义 `AuthoritativeFactsPort` 接口
- ✅ 实现 `StubAuthoritativeFactsProvider`（只填充 knowledge_facts）
- ✅ 明确标记哪些 fact 类型是 stub
- ❌ 不实现 shop_facts / product_facts 的真实聚合
- ❌ 不实现 order_facts / logistics_facts

**接口设计:**
```typescript
export interface AuthoritativeFactsPort {
  gather(params: FactsGatherParams): Promise<AuthoritativeFacts>;
}

export interface FactsGatherParams {
  readonly merchant_id: string;
  readonly store_id: string;
  readonly product_id?: string;
  readonly order_id?: string;
}

// 复用 packages/domain/src/context-envelope.ts 的 AuthoritativeFacts
```

**文件:**
- `apps/desktop/src/main/ports/authoritative-facts-port.ts`（新建）
- `apps/desktop/src/main/adapters/stub-authoritative-facts.ts`（新建）

**工作量:** 1 天

**验收标准:**
- [ ] Port 接口定义完整
- [ ] Stub 实现正确返回 knowledge_facts
- [ ] shop_facts / product_facts 返回空对象（明确标记）
- [ ] typecheck 通过
- [ ] 单元测试通过（需在个人电脑运行）

**依赖:** P1-5（TypeScript 类型）

---

### P1-6d: UnknownIdentifier

**目标:** 实现 Unknown 判定逻辑

**背景:**
- Unknown 是**显式标记**，不是隐式缺失
- Unknown 判定依赖 Scene（不同场景需要不同的 facts）
- Unknown 有 `blocking` 属性，决定是否阻塞发送

**边界:**
- ✅ 实现 `identifyUnknowns(lock, facts, scene)` 纯函数
- ✅ 基于 Scene 判定哪些 facts 是必需的
- ✅ 标记 blocking vs non-blocking unknowns
- ❌ 不修改 ContextEnvelope 类型
- ❌ 不引入 AI 判定

**判定规则（MVP）:**

| Scene | Required Facts | Blocking Unknowns |
|-------|---------------|-------------------|
| SHIPPING_TIME | knowledge_facts[SHIPPING_TIME] | missing_shipping_time_rule |
| OTHER_UNSUPPORTED | (none) | (none) |
| UNKNOWN | identity_lock completeness | incomplete_identity |

**文件:** `apps/desktop/src/main/services/unknown-identifier.ts`（新建）

**工作量:** 1 天

**验收标准:**
- [ ] 纯函数，无副作用
- [ ] SHIPPING_TIME 场景正确检测缺失的 shipping_time rule
- [ ] UNKNOWN 场景正确检测 identity 不完整
- [ ] OTHER_UNSUPPORTED 场景不产生 blocking unknown
- [ ] typecheck 通过
- [ ] 单元测试通过（需在个人电脑运行）

**依赖:** P1-5（TypeScript 类型）、P1-7a（Scene 适配）

---

### P1-6e: ContextEnvelopeBuilder 主入口

**目标:** 组装所有子组件，实现 `build()` 主入口

**边界:**
- ✅ 实现 `ContextEnvelopeBuilder.build(input)` 主方法
- ✅ 调用 IdentityLock 构建
- ✅ 调用 SceneClassifier + 适配
- ✅ 调用 AuthoritativeFactsPort
- ✅ 调用 StoreKnowledgeRetrievalPort
- ✅ 调用 UnknownIdentifier
- ✅ 组装完整 ContextEnvelope
- ❌ 不修改 Orchestrator（P1-6f 做）
- ❌ 不处理错误恢复（MVP 简化）

**接口设计:**
```typescript
export interface ContextEnvelopeBuilderDeps {
  readonly sceneClassifier: MinimalSceneClassifier;
  readonly factsPort: AuthoritativeFactsPort;
  readonly knowledgePort: StoreKnowledgeRetrievalPort;
  readonly clock: Clock;
}

export interface ContextEnvelopeBuildInput {
  readonly turn: InboundTurn;
  readonly messageFacts: readonly SceneMessageFact[];
  readonly productId?: string;
}

export class ContextEnvelopeBuilder {
  constructor(private readonly deps: ContextEnvelopeBuilderDeps) {}
  
  async build(input: ContextEnvelopeBuildInput): Promise<ContextEnvelope> {
    // 1. 构建 IdentityLock（从 InboundTurn）
    // 2. 分类 Scene（调用 MinimalSceneClassifier + 适配）
    // 3. 聚合 Facts（调用 AuthoritativeFactsPort）
    // 4. 检索 Knowledge（调用 StoreKnowledgeRetrievalPort）
    // 5. 判定 Unknowns（调用 UnknownIdentifier）
    // 6. 组装 ContextEnvelope
  }
}
```

**文件:** `apps/desktop/src/main/services/context-envelope-builder.ts`（新建）

**工作量:** 2 天

**验收标准:**
- [ ] 能正确构建完整 ContextEnvelope
- [ ] 依赖注入正确
- [ ] 每个步骤的错误被正确传播
- [ ] typecheck 通过
- [ ] 单元测试通过（需在个人电脑运行，mock 所有依赖）

**依赖:** P1-6a, P1-6b, P1-6c, P1-6d, P1-7a

---

### P1-6f: Orchestrator 集成点（骨架）

**目标:** 在 Orchestrator 中预留 ContextEnvelopeBuilder 的集成点

**背景:**
- 当前 Orchestrator 通过 `onBuyerMessage` → `aiEngineClient.generateReply()` 直接调用 Worker
- 未来流程：`onBuyerMessage` → `Builder.build()` → `Worker.generateReply(ContextEnvelope)` → `Verifier.verify()` → Send
- MVP 阶段：Builder 与现有流程**并行**运行，不影响现有流程

**边界:**
- ✅ 在 Orchestrator 中注入 Builder（可选依赖）
- ✅ 在 `onBuyerMessage` 中调用 Builder（shadow mode）
- ✅ 记录 Builder 输出到日志/事件
- ❌ 不替换现有 AI 调用流程
- ❌ 不实现 Verifier（P2-8）
- ❌ 不修改 Worker 侧

**集成策略:**
```typescript
// OrchestratorOptions 新增可选依赖
export interface OrchestratorOptions {
  // ... existing ...
  readonly contextEnvelopeBuilder?: ContextEnvelopeBuilder; // 可选
}

// onBuyerMessage 中 shadow 调用
async onBuyerMessage(shopId, conversationId, message) {
  // ... existing logic ...
  
  // Shadow: build ContextEnvelope (不影响现有流程)
  if (this.contextEnvelopeBuilder) {
    try {
      const envelope = await this.contextEnvelopeBuilder.build({ turn, messageFacts, productId });
      this.emit("ContextEnvelopeBuilt", { envelope });
    } catch (e) {
      this.emit("ContextEnvelopeBuildFailed", { error: e });
    }
  }
  
  // ... existing AI call ...
}
```

**文件:** `packages/orchestrator/src/core/conversation-orchestrator.ts`（修改）

**工作量:** 1.5 天

**验收标准:**
- [ ] Builder 是可选依赖（不注入时不影响现有流程）
- [ ] Shadow 模式不阻塞主流程
- [ ] Builder 失败不影响 AI 回复生成
- [ ] 事件正确发出
- [ ] typecheck 通过
- [ ] 现有测试不受影响

**依赖:** P1-6e

---

## 三、任务依赖图

```
P1-5 (TypeScript 类型) ✅ 已完成
  │
  ├──→ P1-7a (Scene 适配器) ──────────────┐
  │                                         │
  ├──→ P1-6a (StoreKnowledge Port)         │
  │      │                                  │
  │      └──→ P1-6b (StoreKnowledge Adapter)│
  │                                         │
  ├──→ P1-6c (Facts Port + Stub)           │
  │                                         │
  │                                         ↓
  │                                   P1-6d (UnknownIdentifier)
  │                                         │
  │                                         ↓
  │                                   P1-6e (Builder 主入口)
  │                                         │
  │                                         ↓
  └─────────────────────────────────── P1-6f (Orchestrator 集成)
```

---

## 四、执行顺序

| 序号 | 子任务 | 工作量 | 累计 | 可并行 |
|------|--------|--------|------|--------|
| 1 | P1-7a: Scene 适配器 | 0.25 天 | 0.25 天 | 可与 P1-6a/c 并行 |
| 2 | P1-6a: StoreKnowledge Port | 0.5 天 | 0.75 天 | 可与 P1-7a/c 并行 |
| 3 | P1-6c: Facts Port + Stub | 1 天 | 1.75 天 | 可与 P1-7a/a 并行 |
| 4 | P1-6b: StoreKnowledge Adapter | 1 天 | 2.75 天 | 依赖 P1-6a |
| 5 | P1-6d: UnknownIdentifier | 1 天 | 3.75 天 | 依赖 P1-7a |
| 6 | P1-6e: Builder 主入口 | 2 天 | 5.75 天 | 依赖 P1-6a~d + P1-7a |
| 7 | P1-6f: Orchestrator 集成 | 1.5 天 | 7.25 天 | 依赖 P1-6e |

**总计:** 7.25 天（比原始 8 天估算更精确）

---

## 五、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| RPC 桥基础设施不存在 | P1-6b 阻塞 | 先调研现有 RPC 调用模式，必要时简化为直读 SQLite |
| InboundTurn → IdentityLock 映射复杂 | P1-6e 工作量增加 | Domain Layer 和 Contract Schema 层的映射需要仔细处理 |
| Orchestrator 修改引入回归 | P1-6f 风险高 | Builder 是可选依赖，shadow mode 不影响现有流程 |
| 测试需要在个人电脑运行 | 开发环境无法验证 | typecheck 作为最高验证标准，测试标记为 DEFERRED |

---

## 六、与原始 P1-7 的差异说明

| 维度 | 原始 P1-7 描述 | 实际执行（P1-7a） |
|------|---------------|------------------|
| 场景词汇 | 5 个场景 | 3 个（MINIMAL_V1 有界词汇） |
| 实现方式 | 创建新 Classifier | 适配已有 Classifier |
| 分类策略 | 未明确 | 保持确定性规则分类 |
| 工作量 | 1 天 | 0.25 天（因为大部分已存在） |

**原因:** SHEEP-304 已经实现了 MINIMAL_V1 SceneClassifier，且明确禁止扩展词汇（第二个场景是 `OPEN_DECISION`）。P1-7 的描述与 SHEEP-304 的实现不一致，需要调整。

---

**Document created:** 2026-09-29
**Author:** Codex
**Review authority:** Controller
