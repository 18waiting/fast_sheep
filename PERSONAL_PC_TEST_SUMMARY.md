# 个人电脑测试总结

> **用途:** 在个人电脑（Windows + Node.js v22+）上运行测试  
> **创建日期:** 2026-09-29  
> **环境要求:** Windows, Node.js v22+, Python 3.10+

---

## 一、测试环境准备

### 1.1 环境检查
```bash
# 检查 Node.js 版本（需要 v22+）
node --version

# 检查 Python 版本（需要 3.10+）
python --version

# 检查项目路径
cd E:\fast_sheep
```

### 1.2 安装依赖
```bash
# 安装 Python 依赖
cd services/ai-worker
pip install -e .[dev]

# 安装 Node.js 依赖
cd ../..
pnpm install
```

---

## 二、SHEEP-305 测试（4 个文件）

### 2.1 测试文件列表

| # | 测试文件 | 测试内容 | 优先级 |
|---|---------|---------|--------|
| 1 | `test_retriever_store_knowledge_type.py` | Retriever 的 store_knowledge_type 过滤 | P0 |
| 2 | `test_rag_engine_store_knowledge_type.py` | RAGEngine 传递过滤参数 | P0 |
| 3 | `test_scene_knowledge_mapping.py` | 场景→知识类型映射 | P1 |
| 4 | `test_conversation_engine_scene_routing.py` | ConversationEngine 场景路由集成 | P1 |

### 2.2 运行测试

```bash
# 进入 ai-worker 目录
cd services/ai-worker

# 运行所有 SHEEP-305 相关测试
pytest tests/test_retriever_store_knowledge_type.py -v
pytest tests/test_rag_engine_store_knowledge_type.py -v
pytest tests/test_scene_knowledge_mapping.py -v
pytest tests/test_conversation_engine_scene_routing.py -v

# 或者一次性运行所有测试
pytest tests/test_*knowledge*.py tests/test_*scene*.py -v
```

### 2.3 预期结果

**test_retriever_store_knowledge_type.py:**
- ✅ 5 个测试用例
- 测试 `_search_tier()` 的 `store_knowledge_type` 参数
- 测试过滤逻辑正确性

**test_rag_engine_store_knowledge_type.py:**
- ✅ 8 个测试用例
- 测试 `retrieve()` 从 request 提取参数
- 测试参数传递给 retriever

**test_scene_knowledge_mapping.py:**
- ✅ 27 个测试用例
- 测试映射表完整性
- 测试 `get_knowledge_filter()` 函数
- 测试默认值处理

**test_conversation_engine_scene_routing.py:**
- ✅ 10+ 个测试用例
- 测试场景路由集成
- 测试向后兼容性
- 测试 Trace 日志

### 2.4 测试位置
```
services/ai-worker/tests/
├── test_retriever_store_knowledge_type.py
├── test_rag_engine_store_knowledge_type.py
├── test_scene_knowledge_mapping.py
└── test_conversation_engine_scene_routing.py
```

---

## 三、SHEEP-307 测试（3 个文件，待创建）

### 3.1 测试文件列表

| # | 测试文件 | 测试内容 | 优先级 | 状态 |
|---|---------|---------|--------|------|
| 1 | `test_reply_plan_builder.py` | ReplyPlanBuilder 构建逻辑 | P0 | ❌ 待创建 |
| 2 | `test_conversation_engine_envelope.py` | ConversationEngine envelope 集成 | P0 | ❌ 待创建 |
| 3 | `test_conversation_generate_v2.py` | RPC 方法 generate_v2 | P1 | ❌ 待创建 |

### 3.2 测试用例设计

#### test_reply_plan_builder.py

```python
"""测试 ReplyPlanBuilder"""

def test_build_basic_plan():
    """测试构建基本 ReplyPlan"""
    # 输入：envelope + reply
    # 输出：符合 schema 的 ReplyPlan
    pass

def test_build_plan_with_facts():
    """测试包含 fact_references 的 ReplyPlan"""
    pass

def test_build_plan_with_knowledge():
    """测试包含 knowledge_references 的 ReplyPlan"""
    pass

def test_build_plan_with_inferences():
    """测试包含 inference_references 的 ReplyPlan"""
    pass

def test_build_plan_with_unknowns():
    """测试包含 unknowns 的 ReplyPlan"""
    pass

def test_policy_metadata_defaults():
    """测试 policy_metadata 默认值"""
    # rollout_mode = "HUMAN_CONFIRM"
    # requires_confirmation = True
    pass

def test_verification_requirements():
    """测试 verification_requirements 构建"""
    pass

def test_inherit_from_envelope():
    """测试从 envelope 继承字段"""
    # identity_lock, scene, trigger_message
    pass
```

**预期测试用例数:** 8-10 个

#### test_conversation_engine_envelope.py

```python
"""测试 ConversationEngine.generate_from_envelope()"""

def test_generate_from_envelope_basic():
    """测试基本的 envelope 输入"""
    pass

def test_extract_question_from_trigger_message():
    """测试从 trigger_message.content 提取 question"""
    pass

def test_extract_identity_lock():
    """测试提取 identity_lock 字段"""
    pass

def test_extract_authoritative_facts():
    """测试提取 authoritative_facts"""
    pass

def test_extract_retrieved_knowledge():
    """测试提取 retrieved_knowledge"""
    pass

def test_extract_explicit_unknowns():
    """测试提取 explicit_unknowns"""
    pass

def test_backward_compatibility():
    """测试 generate() 方法保持不变"""
    pass

def test_return_reply_plan():
    """测试返回 ReplyPlan 结构"""
    # 包含 plan, trace, fast_return
    pass
```

**预期测试用例数:** 8-10 个

#### test_conversation_generate_v2.py

```python
"""测试 RPC 方法 conversation.generate_v2"""

def test_generate_v2_rpc_method():
    """测试 RPC 方法注册"""
    pass

def test_validate_context_envelope_input():
    """测试输入验证（context-envelope.schema.json）"""
    pass

def test_validate_reply_plan_output():
    """测试输出验证（reply-plan.schema.json）"""
    pass

def test_error_handling():
    """测试错误处理"""
    pass

def test_end_to_end_flow():
    """测试端到端流程"""
    # ContextEnvelope → ReplyPlan
    pass
```

**预期测试用例数:** 5-8 个

### 3.3 运行测试

```bash
# 运行所有 SHEEP-307 测试
pytest tests/test_reply_plan_builder.py -v
pytest tests/test_conversation_engine_envelope.py -v
pytest tests/test_conversation_generate_v2.py -v

# 或者一次性运行
pytest tests/test_*reply*.py tests/test_*envelope*.py -v
```

### 3.4 测试位置
```
services/ai-worker/tests/
├── test_reply_plan_builder.py (待创建)
├── test_conversation_engine_envelope.py (待创建)
└── test_conversation_generate_v2.py (待创建)
```

---

## 四、TypeScript 测试

### 4.1 运行 typecheck
```bash
# 在项目根目录
pnpm run typecheck
```

### 4.2 运行单元测试
```bash
# 运行所有测试
pnpm run test

# 运行特定包的测试
cd packages/domain
pnpm run test
```

### 4.3 预期测试
- TypeScript 类型定义测试
- ContextEnvelope 构建测试
- ReplyPlan 验证测试

---

## 五、测试报告模板

### 5.1 测试结果记录

```markdown
## 测试结果

**测试日期:** YYYY-MM-DD  
**测试环境:** Windows XX, Node.js vXX, Python 3.XX

### SHEEP-305 测试结果

| 测试文件 | 测试用例数 | 通过 | 失败 | 跳过 | 状态 |
|---------|-----------|------|------|------|------|
| test_retriever_store_knowledge_type.py | 5 | 5 | 0 | 0 | ✅ PASS |
| test_rag_engine_store_knowledge_type.py | 8 | 8 | 0 | 0 | ✅ PASS |
| test_scene_knowledge_mapping.py | 27 | 27 | 0 | 0 | ✅ PASS |
| test_conversation_engine_scene_routing.py | 10 | 10 | 0 | 0 | ✅ PASS |

**总计:** 50 个测试用例，50 通过，0 失败

### SHEEP-307 测试结果

| 测试文件 | 测试用例数 | 通过 | 失败 | 跳过 | 状态 |
|---------|-----------|------|------|------|------|
| test_reply_plan_builder.py | 10 | ? | ? | ? | ⏳ 待测试 |
| test_conversation_engine_envelope.py | 10 | ? | ? | ? | ⏳ 待测试 |
| test_conversation_generate_v2.py | 8 | ? | ? | ? | ⏳ 待测试 |

**总计:** ? 个测试用例，? 通过，? 失败
```

### 5.2 失败测试处理

如果测试失败：
1. 记录失败信息（错误消息、堆栈跟踪）
2. 检查是否是代码问题或测试问题
3. 修复代码或测试
4. 重新运行测试

---

## 六、测试完成后

### 6.1 更新 PROJECT_STATE.json

测试通过后，更新 `PROJECT_STATE.json`：

```json
{
  "deferred_tests": {
    "SHEEP-305": {
      "status": "PASS",
      "test_date": "YYYY-MM-DD",
      "test_environment": "Windows XX, Node.js vXX, Python 3.XX"
    },
    "SHEEP-307": {
      "status": "PASS",
      "test_date": "YYYY-MM-DD",
      "test_environment": "Windows XX, Node.js vXX, Python 3.XX"
    }
  }
}
```

### 6.2 生成测试报告

在 `project/` 目录生成测试报告：
- `SHEEP_305_TEST_REPORT.md`
- `SHEEP_307_TEST_REPORT.md`

### 6.3 提交代码

```bash
git add .
git commit -m "test: SHEEP-305/307 tests pass on personal PC"
git push
```

---

## 七、快速参考

### 7.1 测试命令速查

```bash
# SHEEP-305 测试
cd services/ai-worker
pytest tests/test_retriever_store_knowledge_type.py -v
pytest tests/test_rag_engine_store_knowledge_type.py -v
pytest tests/test_scene_knowledge_mapping.py -v
pytest tests/test_conversation_engine_scene_routing.py -v

# SHEEP-307 测试（待创建）
pytest tests/test_reply_plan_builder.py -v
pytest tests/test_conversation_engine_envelope.py -v
pytest tests/test_conversation_generate_v2.py -v

# TypeScript typecheck
cd ../..
pnpm run typecheck
```

### 7.2 文件位置速查

```
项目根目录/
├── services/ai-worker/
│   ├── src/fastwork_ai_worker/
│   │   ├── rag/
│   │   │   ├── retriever.py (SHEEP-305)
│   │   │   └── rag_engine.py (SHEEP-305)
│   │   └── conversation/
│   │       ├── scene_knowledge_mapping.py (SHEEP-305)
│   │       ├── conversation_engine.py (SHEEP-305/307)
│   │       └── reply_plan_builder.py (SHEEP-307)
│   └── tests/
│       ├── test_retriever_store_knowledge_type.py (SHEEP-305)
│       ├── test_rag_engine_store_knowledge_type.py (SHEEP-305)
│       ├── test_scene_knowledge_mapping.py (SHEEP-305)
│       ├── test_conversation_engine_scene_routing.py (SHEEP-305)
│       ├── test_reply_plan_builder.py (SHEEP-307, 待创建)
│       ├── test_conversation_engine_envelope.py (SHEEP-307, 待创建)
│       └── test_conversation_generate_v2.py (SHEEP-307, 待创建)
├── packages/domain/src/
│   ├── knowledge.ts (SHEEP-305)
│   ├── context-envelope.ts (SHEEP-306)
│   └── reply-plan.ts (SHEEP-306)
└── apps/desktop/src/main/services/
    └── context-envelope-builder.ts (SHEEP-305)
```

---

## 八、联系和支持

如果测试过程中遇到问题：
1. 检查错误消息和堆栈跟踪
2. 查看相关代码文件
3. 参考审计报告：`project/SHEEP_305_306_307_AUDIT_REPORT.md`
4. 参考执行计划：`project/SHEEP_305_EXECUTION_PLAN.md`, `project/SHEEP_307_EXECUTION_PLAN.md`

---

**文档版本:** v1.0  
**创建日期:** 2026-09-29  
**创建人:** Codex

---

## 九、SHEEP-308 测试（2 个 TypeScript 测试文件）

### 9.1 测试目标

验证 Deterministic Policy and RolloutMode Gate 的正确性：
- PolicyEngine 的 7 步评估流程
- RolloutModeResolver 的配置层次和条件覆盖
- Blocking unknowns 正确阻止执行
- IdentityLock 验证
- 向后兼容性

### 9.2 测试文件列表

| # | 测试文件 | 测试内容 | 用例数 | 优先级 |
|---|---------|---------|--------|--------|
| 1 | `apps/desktop/tests/rollout-mode-resolver.test.ts` | RolloutModeResolver 配置解析 | 10+ | P0 |
| 2 | `apps/desktop/tests/policy-engine.test.ts` | PolicyEngine 评估逻辑 | 15+ | P0 |

### 9.3 运行测试

```bash
# 在项目根目录
cd E:\fast_sheep

# 运行 RolloutModeResolver 测试
pnpm run test apps/desktop/tests/rollout-mode-resolver.test.ts

# 运行 PolicyEngine 测试
pnpm run test apps/desktop/tests/policy-engine.test.ts

# 或者一次性运行所有 SHEEP-308 测试
pnpm run test apps/desktop/tests/rollout-mode-resolver.test.ts apps/desktop/tests/policy-engine.test.ts
```

### 9.4 测试用例详情

#### rollout-mode-resolver.test.ts

**测试组 1: Global Default**
| 用例 | 输入 | 期望输出 | 验收标准 |
|------|------|---------|---------|
| returns global default when no overrides | config={global:{default_mode:"HUMAN_CONFIRM"}} | mode="HUMAN_CONFIRM", source="global" | 无覆盖时返回全局默认 |
| returns OFF when global default is OFF | config={global:{default_mode:"OFF"}} | mode="OFF", source="global" | OFF 模式正确返回 |

**测试组 2: Shop-level Override**
| 用例 | 输入 | 期望输出 | 验收标准 |
|------|------|---------|---------|
| returns shop override when configured | shop_id="shop_123", shops={"shop_123":{default_mode:"SHADOW"}} | mode="SHADOW", source="shop" | 店铺级覆盖生效 |
| falls back to global for unconfigured shop | shop_id="shop_456", shops 仅有 "shop_123" | mode="HUMAN_CONFIRM", source="global" | 未配置店铺回退全局 |

**测试组 3: Conditional Overrides**
| 用例 | 输入 | 期望输出 | 验收标准 |
|------|------|---------|---------|
| applies override when scene matches | scene="REFUND", condition={scene:"REFUND"} | mode="HUMAN_CONFIRM", source="override" | 场景匹配触发覆盖 |
| applies override when risk_level matches | risk_level="high", condition={risk_level:"high"} | mode="HUMAN_CONFIRM", source="override" | 风险等级匹配触发覆盖 |
| applies override when has_blocking_unknowns matches | has_blocking_unknowns=true, condition={has_blocking_unknowns:true} | mode="OFF", source="override" | Blocking unknowns 触发覆盖 |
| ignores override when condition does not match | scene="SHIPPING", condition={scene:"REFUND"} | mode="HUMAN_CONFIRM", source="shop" | 条件不匹配不触发 |

**测试组 4: AND Logic**
| 用例 | 输入 | 期望输出 | 验收标准 |
|------|------|---------|---------|
| applies override only when ALL conditions match | scene="REFUND", risk_level="high", condition={scene:"REFUND", risk_level:"high"} | mode="OFF" | AND 逻辑：全部匹配才触发 |
| does not apply when only partial match | scene="REFUND", risk_level="low" | mode="HUMAN_CONFIRM" | AND 逻辑：部分匹配不触发 |

#### policy-engine.test.ts

**测试组 1: IdentityLock Validation**
| 用例 | 输入 | 期望输出 | 验收标准 |
|------|------|---------|---------|
| blocks when merchant_id is missing | identity_lock.merchant_id="" | allowed=false, blocking_issues 包含 "merchant_id" | 缺失字段阻止执行 |
| blocks when store_id is missing | identity_lock.store_id="" | allowed=false, blocking_issues 包含 "store_id" | 缺失字段阻止执行 |
| blocks when customer_identity is incomplete | customer_identity.value="" | allowed=false, blocking_issues 包含 "customer_identity" | 不完整身份阻止执行 |
| passes with valid IdentityLock | 所有字段有效 | allowed=true, reasons 包含 "IdentityLock validated" | 有效 IdentityLock 通过 |

**测试组 2: Blocking Unknowns**
| 用例 | 输入 | 期望输出 | 验收标准 |
|------|------|---------|---------|
| blocks when blocking unknowns present | explicit_unknowns=[{blocking:true}] | allowed=false, blocking_issues 包含 "Blocking unknown" | **关键:** blocking unknowns 必须阻止执行 |
| allows when unknowns are non-blocking | explicit_unknowns=[{blocking:false}] | allowed=true | 非阻塞 unknowns 不影响 |

**测试组 3: RolloutMode Resolution**
| 用例 | 输入 | 期望输出 | 验收标准 |
|------|------|---------|---------|
| returns HUMAN_CONFIRM by default | config={global:{default_mode:"HUMAN_CONFIRM"}} | rollout_mode="HUMAN_CONFIRM", requires_confirmation=true | 默认需要人工确认 |
| returns SHADOW when configured | config={global:{default_mode:"SHADOW"}} | rollout_mode="SHADOW", requires_confirmation=false | SHADOW 模式不需要确认 |
| returns OFF when configured | config={global:{default_mode:"OFF"}} | rollout_mode="OFF" | OFF 模式正确返回 |

**测试组 4: Risk Assessment**
| 用例 | 输入 | 期望输出 | 验收标准 |
|------|------|---------|---------|
| returns SHADOW for medium-risk scene | scene="REFUND", config={global:{default_mode:"SHADOW"}} | rollout_mode="SHADOW" | 中风险场景不强制 HUMAN_CONFIRM |
| blocks entirely when blocking unknowns | explicit_unknowns=[{blocking:true}], config={global:{default_mode:"SHADOW"}} | allowed=false | **关键:** blocking unknowns 完全阻止，不仅仅是降级 |

**测试组 5: Policy Metadata**
| 用例 | 输入 | 期望输出 | 验收标准 |
|------|------|---------|---------|
| includes evaluation timestamp | 正常输入 | evaluated_at 匹配 ISO 8601 格式 | 时间戳格式正确 |
| includes policy version | 正常输入 | policy_version="1.0.0" | 版本号正确 |
| includes reasons for decision | 正常输入 | reasons.length > 0 | 决策原因不为空 |

### 9.5 验收标准总结

**P0 必须通过（安全关键）:**
1. ✅ Blocking unknowns 必须阻止执行（`allowed=false`）
2. ✅ IdentityLock 缺失字段必须阻止执行
3. ✅ HUMAN_CONFIRM 模式 `requires_confirmation=true`
4. ✅ SHADOW 模式 `requires_confirmation=false`

**P1 应该通过（功能正确）:**
5. ✅ RolloutModeResolver 配置层次正确（GLOBAL → SHOP）
6. ✅ 条件覆盖 AND 逻辑正确
7. ✅ 风险评估基于 scene
8. ✅ PolicyDecision 包含完整审计信息

**P2 最好通过（质量保障）:**
9. ✅ 向后兼容（不配置 PolicyEngine 时行为不变）
10. ✅ 时间戳格式正确
11. ✅ 决策原因不为空

### 9.6 测试位置

```
apps/desktop/tests/
├── rollout-mode-resolver.test.ts (SHEEP-308)
└── policy-engine.test.ts (SHEEP-308)
```

### 9.7 已知问题

**审计发现的 Bug（已在 macOS 修复，需在个人电脑验证）:**
1. **Bug 1 (CRITICAL):** Blocking unknowns 原本不阻止执行 → 已修复（添加提前返回）
2. **Bug 2 (MEDIUM):** assessRiskLevel 死代码 → 已清理

**修复后需在个人电脑验证:**
- 运行完整测试套件
- 确认所有测试用例通过
- 特别关注 "blocks when blocking unknowns present" 用例

### 9.8 相关文档

- 审计报告: `project/SHEEP_308_AUDIT_REPORT.md`
- 完成报告: `project/SHEEP_308_COMPLETION_REPORT.md`
- 子任务报告: `project/SHEEP_308_SUBTASK_{1-7}_REPORT.md`

---

**文档更新:** v1.1（新增 SHEEP-308 测试）  
**更新日期:** 2026-09-29

---

## 十、SHEEP-309 测试（SHADOW End-to-End Audit）

### 10.1 测试文件列表

| # | 测试文件 | 测试内容 | 优先级 | 状态 |
|---|---------|---------|--------|------|
| 1 | `apps/desktop/tests/audit-logger.test.ts` | AuditLogger 持久化审计 | P0 | ✅ 已创建 |
| 2 | `apps/desktop/tests/transport-blocker.test.ts` | TransportBlocker 零发送验证 | P0 | ✅ 已创建 |
| 3 | `apps/desktop/tests/shadow-pipeline-orchestrator.test.ts` | 11 步流水线编排 | P0 | ❌ 待创建 |
| 4 | `apps/desktop/tests/audit-report-generator.test.ts` | 审计报告生成 | P1 | ❌ 待创建 |

### 10.2 已有测试运行

```bash
# AuditLogger 测试
pnpm run test apps/desktop/tests/audit-logger.test.ts

# TransportBlocker 测试
pnpm run test apps/desktop/tests/transport-blocker.test.ts
```

### 10.3 AuditLogger 测试用例

| # | 测试名称 | 描述 | 预期结果 |
|---|---------|------|---------|
| 1 | startRun | 创建新的审计运行 | 返回 AuditRun，status=RUNNING |
| 2 | completeRun | 完成审计运行 | status=COMPLETED，completedAt 设置 |
| 3 | failRun | 标记运行为失败 | status=FAILED，errorSummary 记录 |
| 4 | recordStep (SUCCESS) | 记录成功步骤 | 步骤持久化，status=SUCCESS |
| 5 | recordStep (FAILED) | 记录失败步骤 | status=FAILED，errorDetail 记录 |
| 6 | recordEvent | 记录细粒度事件 | 事件持久化 |
| 7 | getRun | 获取运行记录 | 返回正确的 AuditRun |
| 8 | getSteps | 获取步骤列表 | 按 stepOrder 排序 |
| 9 | getEvents | 获取事件列表 | 按 createdAt 排序 |

### 10.4 TransportBlocker 测试用例

| # | 测试名称 | 描述 | 预期结果 |
|---|---------|------|---------|
| 1 | isTransportAllowed (OFF) | OFF 模式阻止 | false |
| 2 | isTransportAllowed (SHADOW) | SHADOW 模式阻止 | false |
| 3 | isTransportAllowed (HUMAN_CONFIRM) | HUMAN_CONFIRM 阻止 | false |
| 4 | isTransportAllowed (AUTO) | AUTO 模式允许 | true |
| 5 | recordTransportAttempt | 记录尝试 | 计数器增加 |
| 6 | verifyZeroSends (无尝试) | 无尝试验证 | allowed=true |
| 7 | verifyZeroSends (有尝试) | 有尝试验证 | allowed=false |
| 8 | reset | 重置计数器 | 计数归零 |

### 10.5 Orchestrator 测试用例（待创建）

| # | 测试名称 | 描述 | 预期结果 |
|---|---------|------|---------|
| 1 | execute - 完整流水线 | 正常执行 11 步 | status=COMPLETED |
| 2 | execute - 重复消息 | persistence 返回 DUPLICATE | 提前返回，totalMessages=0 |
| 3 | execute - Turn 等待 | quiet window 过期后获取 turn | turn 正确获取 |
| 4 | execute - RPC 失败 | workerClient 抛异常 | Step 7 失败，流水线继续 |
| 5 | execute - Transport 安全 | verifyZeroSends 通过 | successfulSends=0 |
| 6 | execute - Transport 违规 | 检测到 transport 调用 | Step 10 失败 |
| 7 | execute - 审计完整性 | 所有步骤记录 | getSteps 返回 11 步 |
| 8 | execute - 错误处理 | 未捕获异常 | status=FAILED |

### 10.6 关键验收标准

**P0 必须通过（安全关键）:**
1. ✅ TRANSPORT SEND CALLS = 0（零发送保证）
2. ✅ 所有 11 个步骤正确记录到审计数据库
3. ✅ TransportBlocker 正确阻止 SHADOW/OFF/HUMAN_CONFIRM 模式
4. ✅ AuditLogger 正确持久化所有审计数据

**P1 应该通过（功能正确）:**
5. ✅ Turn 等待机制正确（quiet window 过期后获取 turn）
6. ✅ 错误处理正确（步骤失败不中断流水线）
7. ✅ 审计报告正确生成（包含所有步骤和指标）
8. ✅ 关键指标正确提取（scene, knowledge, ReplyPlan, policy）

### 10.7 审核发现的问题（已修复）

**审核日期:** 2026-09-30

| # | 严重度 | 问题 | 状态 | 修复 |
|---|--------|------|------|------|
| 1 | 🔴 CRITICAL | Turn 可用性时序：ingest 后立即 poll，但 quiet window 未过期 | ✅ 已修复 | 添加 poll 重试循环（20ms 间隔，1s 超时） |
| 2 | 🟡 MEDIUM | factsPort 死依赖：注入但从未使用 | ⏳ 已知 | 不影响功能，未来清理 |
| 3 | 🟡 MEDIUM | messageFacts 内容不完整：只有当前消息有 contentText | ⏳ 已知 | 不影响单消息场景，burst 场景需关注 |

**修复详情（问题 1）:**
- **原因:** `turnBuilder.ingest()` 后消息进入 quiet window（500ms），`poll()` 立即调用返回空
- **修复:** 
  1. Bootstrap 使用 50ms quiet window（原 500ms）
  2. Orchestrator 添加 poll 重试循环（20ms 间隔，1s 超时）
- **Commit:** `326d104 fix(SHEEP-309): fix turn availability timing in orchestrator`

### 10.8 集成测试（待创建）

```bash
# SHADOW 模式端到端集成测试
pnpm run test apps/desktop/tests/integration/shadow-mode-integration.test.ts
```

**测试场景:**
1. 模拟 InboundEnvelope → 完整流水线 → ReplyPlan 生成
2. 验证所有 11 步执行成功
3. 验证 TRANSPORT SEND CALLS = 0
4. 验证审计报告生成

### 10.9 相关文档

- 测试要求: `project/SHEEP_309_TEST_REQUIREMENTS.md`
- 验证报告: `project/SHEEP_309_VALIDATION_REPORT.md`
- 任务报告: `project/SHEEP_309_TASK_REPORT.md`
- 执行计划: `project/SHEEP_309_EXECUTION_PLAN.md`

---

**文档更新:** v1.2（新增 SHEEP-309 测试）  
**更新日期:** 2026-09-30

---

## 11. SHEEP-310: Retry Conflict and Wrong-Target Gate

**任务状态:** COMPLETE (待 Controller PASS)  
**测试状态:** DEFERRED — 需要在个人电脑（Node.js v22+）上运行

### 11.1 测试文件

| 文件 | 测试数量 | 描述 |
|------|---------|------|
| `packages/orchestrator/tests/send-failure-classifier.test.ts` | 17 | 发送失败分类器 |
| `packages/orchestrator/tests/wrong-target-validator.test.ts` | 14 | 错误目标验证器 |
| `packages/orchestrator/tests/binding-validator.test.ts` | 10 | 绑定验证器 |
| `packages/orchestrator/tests/retry-policy.test.ts` | 5 | 重试策略 |
| `packages/orchestrator/tests/wrong-target-adversarial.test.ts` | 10 | 对抗性测试 |

**总计:** 56 个测试用例

### 11.2 测试命令

```bash
cd packages/orchestrator
node --test "tests/send-failure-classifier.test.ts"
node --test "tests/wrong-target-validator.test.ts"
node --test "tests/binding-validator.test.ts"
node --test "tests/retry-policy.test.ts"
node --test "tests/wrong-target-adversarial.test.ts"

# 或者运行所有测试
node --test "tests/*.test.ts"
```

### 11.3 关键测试场景

**SendFailureClassifier:**
- 成功发送返回非重试
- 网络错误（SAFE_PRE_ATTEMPT）允许重试
- 有 messageId 但失败（ATTEMPTED_UNKNOWN）禁止重试
- 部分发送（SIDE_EFFECT_POSSIBLE）禁止重试
- 平台拒绝（EXPLICIT_REJECTED）禁止重试
- 错误标准化（字符串、对象、未知类型）

**WrongTargetValidator:**
- 有效上下文通过验证
- 空 shopId/conversationId 拒绝
- 跨店铺执行拒绝
- customerUid 不匹配拒绝（独立于 conversationId）
- 空 triggerMessageId 拒绝（stale selection）
- documentVersion 不匹配拒绝

**BindingValidator:**
- 所有绑定完整通过
- 缺少任一绑定拒绝
- 所有绑定缺失报告 6 个失败

**RetryPolicy:**
- SAFE_PRE_ATTEMPT 允许重试
- 其他 3 种类型禁止重试
- 核心安全不变量验证

**对抗性测试:**
- 跨店铺执行被拒绝
- 过期选择被拒绝
- 无效绑定被拒绝
- customerUid 不匹配被拒绝
- 文档版本不匹配被拒绝
- 重试策略安全不变量
- 多重失败全部报告
- 所有绑定缺失被完全拒绝
- 未知错误保守分类为不重试
- 有效上下文通过所有验证

### 11.4 核心安全不变量

**重试策略不变量：**
- 只有 `SAFE_PRE_ATTEMPT` 失败类型允许重试
- `ATTEMPTED_UNKNOWN`、`SIDE_EFFECT_POSSIBLE`、`EXPLICIT_REJECTED` 绝不重试

**目标验证不变量：**
- `customerUid` 独立于 `conversationId` 验证
- 跨店铺执行被拒绝
- 过期选择被拒绝

### 11.5 验收标准

- [ ] 所有 56 个测试通过
- [ ] 重试策略安全不变量验证通过
- [ ] 对抗性测试全部通过
- [ ] Typecheck 通过（已在开发环境验证）

### 11.6 现有测试兼容性验证

SHEEP-310 修改了 `performSend()` 的重试逻辑，以下现有测试需要在个人电脑上验证仍然通过：

| 测试文件 | 测试名称 | 验证内容 |
|---------|---------|---------|
| `packages/orchestrator/tests/send-failure.test.ts` | send failure -> refill/retry once (GF-ORCH-008) | 网络错误触发 refill_on_failure |
| `packages/orchestrator/tests/orchestrator-golden-fixtures.test.ts` | GF-ORCH-008 | 金色测试：发送失败→重试 |

**修复说明：**
- `FakePlatformAdapter` 的错误消息从 `"send_failed"` 改为 `"Network error: send failed"`
- 使其被 `SendFailureClassifier` 正确分类为 `SAFE_PRE_ATTEMPT`（允许重试）
- 保持现有测试的预期行为不变

**验证命令：**
```bash
cd packages/orchestrator
node --test "tests/send-failure.test.ts"
node --test "tests/orchestrator-golden-fixtures.test.ts"
```

### 11.6 相关文档

- 任务报告: `project/SHEEP_310_TASK_REPORT.md`
- 验证报告: `project/SHEEP_310_VALIDATION_REPORT.md`
- 执行计划: `project/SHEEP_310_EXECUTION_PLAN.md`

---

**文档更新:** v1.4（新增现有测试兼容性验证 + FakePlatformAdapter 修复说明）  
**更新日期:** 2026-09-30

---

## 12. SHEEP-311: HUMAN_CONFIRM PDD Transport and Verification

**任务状态:** IN_PROGRESS (子任务 1 完成)  
**测试状态:** DEFERRED — 需要在个人电脑（Node.js v22+）上运行

### 12.1 子任务 1: TransportOutcome 类型定义

**测试文件:**
- `packages/domain/tests/transport-outcome.test.ts` (14 tests)

**测试命令:**
```bash
cd packages/domain
node --test "tests/transport-outcome.test.ts"
```

**测试场景:**
1. createAcknowledgedOutcome - 创建 ACKNOWLEDGED 结果
2. createAcknowledgedOutcome - 自定义时间戳
3. createRejectedOutcome - 创建 REJECTED 结果
4. createRejectedOutcome - 包含原始响应
5. createUnknownOutcome - 创建 UNKNOWN 结果（必须提供原因和上下文）
6. createUnknownOutcome - 包含原始响应
7. isUnknownOutcome - 类型守卫
8. isAcknowledgedOutcome - 类型守卫
9. isRejectedOutcome - 类型守卫
10. 类型安全 - UnknownOutcome 必须包含 reason 和 context
11. 类型安全 - AcknowledgedOutcome 必须包含 platform_message_id
12. 类型安全 - RejectedOutcome 必须包含 rejected_at
13. 所有结果类型都是不可变的
14. UNKNOWN 结果用于停止自动执行

**验收标准:**
- [ ] 所有 14 个测试通过
- [ ] 类型守卫正确工作
- [ ] UNKNOWN 结果强制包含 reason 和 context
- [ ] Typecheck 通过（已在开发环境验证）

**相关文档:**
- 任务定义: `project/SHEEP_311_TASK_DEFINITION.md`
- 执行计划: `project/SHEEP_311_EXECUTION_PLAN.md`

---

**文档更新:** v1.5（新增 SHEEP-311 子任务 1 测试）  
**更新日期:** 2026-09-30
