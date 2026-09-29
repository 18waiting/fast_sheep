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
