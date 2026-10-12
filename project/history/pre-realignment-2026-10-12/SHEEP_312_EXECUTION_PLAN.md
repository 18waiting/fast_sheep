# SHEEP-312 执行计划：AUTO Safety and Adversarial Validation

**任务 ID:** SHEEP-312  
**日期:** 2026-09-30  
**预估工期:** 5-7 天  
**依赖:** SHEEP-311 ✅

---

## 一、执行策略

SHEEP-312 是一个**验证任务**，不是实现任务。核心目标是：
1. 验证现有实现的安全性
2. 进行全面的对抗性测试
3. 准备生产授权包
4. 保持 AUTO 授权为 NOT_GRANTED

---

## 二、子任务分解

### 子任务 1：IdentityLock 验证审计（1 天）

**目标：** 审计和验证 IdentityLock 验证的确定性

**工作内容：**
1. 审查 `HumanConfirmController.validateConfirmation()` 实现
2. 审查 `WrongTargetValidator` 实现
3. 审查 `BindingValidator` 实现
4. 验证所有 IdentityLock 字段都被检查
5. 验证验证逻辑是确定性的（不依赖 AI 置信度）
6. 编写验证报告

**文件：**
- 审查：`packages/orchestrator/src/core/human-confirm-controller.ts`
- 审查：`packages/orchestrator/src/core/wrong-target-validator.ts`
- 审查：`packages/orchestrator/src/core/binding-validator.ts`
- 新建：`project/SHEEP_312_IDENTITY_LOCK_AUDIT.md`

**验收标准：**
- [ ] AC1: 所有 IdentityLock 字段都被验证
- [ ] AC2: 验证逻辑是确定性的
- [ ] AC3: 验证结果可审计
- [ ] AC4: 审计报告完成

---

### 子任务 2：Wrong-Target Gate 完整性验证（1 天）

**目标：** 验证 wrong-target gate 覆盖所有必需的绑定

**工作内容：**
1. 审查 WrongTargetValidator 覆盖的字段
2. 审查 BindingValidator 覆盖的绑定
3. 验证 shop/customer/conversation/session/document/trigger 都被覆盖
4. 编写单元测试补充缺失的验证场景
5. 编写验证报告

**文件：**
- 审查：`packages/orchestrator/src/core/wrong-target-validator.ts`
- 审查：`packages/orchestrator/src/core/binding-validator.ts`
- 新建/修改：`packages/orchestrator/tests/wrong-target-validator.test.ts`
- 新建/修改：`packages/orchestrator/tests/binding-validator.test.ts`
- 新建：`project/SHEEP_312_WRONG_TARGET_AUDIT.md`

**验收标准：**
- [ ] AC1: shop 绑定验证完整
- [ ] AC2: customer 绑定验证完整
- [ ] AC3: conversation 绑定验证完整
- [ ] AC4: session 绑定验证完整
- [ ] AC5: document 绑定验证完整
- [ ] AC6: trigger 绑定验证完整
- [ ] AC7: 单元测试覆盖所有场景
- [ ] AC8: 审计报告完成

---

### 子任务 3：UNKNOWN 语义和重试策略验证（1 天）

**目标：** 验证 UNKNOWN 结果不会自动重试，处理和升级逻辑正确

**工作内容：**
1. 审查 RetryPolicy 实现
2. 验证 UNKNOWN 结果不会触发重试
3. 验证 attempted 状态不会自动重试
4. 验证 UNKNOWN 触发桌面通知
5. 验证 UNKNOWN 记录到审计日志
6. 编写对抗性测试

**文件：**
- 审查：`packages/orchestrator/src/policies/retry-policy.ts`
- 审查：`packages/orchestrator/src/core/conversation-orchestrator.ts`
- 新建/修改：`packages/orchestrator/tests/retry-policy-adversarial.test.ts`
- 新建：`project/SHEEP_312_UNKNOWN_SEMANTICS_AUDIT.md`

**验收标准：**
- [ ] AC1: UNKNOWN 结果不会触发重试
- [ ] AC2: attempted 状态不会自动重试
- [ ] AC3: UNKNOWN 触发桌面通知
- [ ] AC4: UNKNOWN 记录到审计日志
- [ ] AC5: 对抗性测试通过
- [ ] AC6: 审计报告完成

---

### 子任务 4：跨目标对抗性测试套件（1.5 天）

**目标：** 全面的跨目标对抗性测试

**工作内容：**
1. 设计跨店铺攻击场景
2. 设计跨账号攻击场景
3. 设计跨客户攻击场景
4. 设计跨会话攻击场景
5. 设计跨触发消息攻击场景
6. 实现对抗性测试套件
7. 验证所有攻击都被拒绝

**文件：**
- 新建：`packages/orchestrator/tests/auto-safety-adversarial.test.ts`

**测试场景：**
| 场景 | 描述 | 预期结果 |
|------|------|---------|
| 跨店铺执行 | 使用店铺 A 的确认执行店铺 B 的发送 | 拒绝 |
| 跨账号执行 | 使用账号 A 的确认执行账号 B 的发送 | 拒绝 |
| 跨客户执行 | 使用客户 A 的确认发送给客户 B | 拒绝 |
| 跨会话执行 | 使用会话 A 的确认执行会话 B 的发送 | 拒绝 |
| 跨触发消息执行 | 使用消息 A 的确认执行消息 B 的发送 | 拒绝 |
| 过期确认执行 | 使用过期的确认执行发送 | 拒绝 |
| 重复确认执行 | 使用已使用的确认再次执行 | 拒绝 |
| 缺失绑定执行 | 缺少任何绑定的执行 | 拒绝 |
| UNKNOWN 后重试 | UNKNOWN 结果后自动重试 | 拒绝 |
|  attempted 后重试 | attempted 状态后自动重试 | 拒绝 |

**验收标准：**
- [ ] AC1: 所有跨目标攻击被拒绝
- [ ] AC2: 所有边界情况被覆盖
- [ ] AC3: 错误信息清晰明确
- [ ] AC4: Typecheck 通过
- [ ] AC5: 测试覆盖完整

---

### 子任务 5：审计链完整性验证（0.5 天）

**目标：** 验证审计链的完整性和可追溯性

**工作内容：**
1. 审查 AuditCorrelation 实现
2. 验证所有事件都被记录
3. 验证审计链的完整性
4. 编写端到端审计测试

**文件：**
- 审查：`packages/domain/src/audit-correlation.ts`
- 新建/修改：`packages/domain/tests/audit-correlation-completeness.test.ts`
- 新建：`project/SHEEP_312_AUDIT_CHAIN_AUDIT.md`

**验收标准：**
- [ ] AC1: 所有事件都被记录
- [ ] AC2: 审计链完整且可追溯
- [ ] AC3: 端到端测试通过
- [ ] AC4: 审计报告完成

---

### 子任务 6：AUTO 生产授权包准备（1 天）

**目标：** 准备完整的 AUTO 生产授权包供 Controller 审核

**工作内容：**
1. 汇总所有安全验证结果
2. 汇总所有对抗性测试结果
3. 准备审计日志样本
4. 编写风险评估报告
5. 编写授权包文档

**文件：**
- 新建：`project/SHEEP_312_PRODUCTION_AUTHORIZATION_PACKAGE.md`

**授权包内容：**
1. **执行摘要**
   - 任务目标
   - 验证范围
   - 关键发现
   - 建议

2. **安全验证报告**
   - IdentityLock 验证审计
   - Wrong-target gate 审计
   - UNKNOWN 语义审计
   - 审计链审计

3. **对抗性测试报告**
   - 测试场景清单
   - 测试结果汇总
   - 失败场景分析
   - 修复建议

4. **审计日志样本**
   - 成功执行样本
   - 失败执行样本
   - UNKNOWN 处理样本
   - 跨目标拒绝样本

5. **风险评估报告**
   - 技术风险
   - 安全风险
   - 合规风险
   - 缓解措施

6. **授权建议**
   - 授权条件
   - 授权限制
   - 监控要求
   - 回滚计划

**验收标准：**
- [ ] AC1: 授权包文档完整
- [ ] AC2: 所有验证结果汇总
- [ ] AC3: 风险评估完成
- [ ] AC4: 授权建议明确

---

### 子任务 7：PROJECT_STATE 更新和文档（0.5 天）

**目标：** 更新 PROJECT_STATE.json 和完成所有文档

**工作内容：**
1. 更新 PROJECT_STATE.json
2. 编写任务报告
3. 编写验证报告
4. 确保 AUTO 授权保持 NOT_GRANTED

**文件：**
- 修改：`project/PROJECT_STATE.json`
- 新建：`project/SHEEP_312_TASK_REPORT.md`
- 新建：`project/SHEEP_312_VALIDATION_REPORT.md`

**验收标准：**
- [ ] AC1: PROJECT_STATE.json 更新
- [ ] AC2: 任务报告完成
- [ ] AC3: 验证报告完成
- [ ] AC4: AUTO 授权保持 NOT_GRANTED

---

## 三、执行顺序和依赖

```
子任务 1 (IdentityLock 审计) ──→ 子任务 4 (对抗性测试)
                                      ↓
子任务 2 (Wrong-Target 审计) ────→ 子任务 4
                                      ↓
子任务 3 (UNKNOWN 语义审计) ─────→ 子任务 4
                                      ↓
                                子任务 5 (审计链审计)
                                      ↓
                                子任务 6 (授权包准备)
                                      ↓
                                子任务 7 (文档和状态更新)
```

**关键路径：** 1 → 4 → 5 → 6 → 7

**并行机会：**
- 子任务 1、2、3 可以并行
- 子任务 4 依赖子任务 1、2、3
- 子任务 5 依赖子任务 4
- 子任务 6 依赖子任务 5
- 子任务 7 依赖子任务 6

---

## 四、资源需求

### 4.1 人力资源

- **Codex AI Agent:** 主要执行者
- **Controller:** 审核和授权

### 4.2 时间资源

- **预估总工期:** 5-7 天
- **关键路径:** 5 天
- **缓冲时间:** 2 天

### 4.3 技术资源

- **开发环境:** macOS（公司电脑）
- **测试环境:** Windows（个人电脑）
- **Typecheck:** pnpm run typecheck
- **测试:** pnpm run test（需要在个人电脑上运行）

---

## 五、风险管理

### 5.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 现有实现存在未发现的边界情况 | 中 | 高 | 全面的对抗性测试 |
| 测试覆盖不完整 | 低 | 中 | 代码审查 + 测试审查 |
| Typecheck 失败 | 低 | 中 | 持续集成验证 |

### 5.2 安全风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| AUTO 模式被意外启用 | 低 | 极高 | 明确的治理约束 |
| 跨目标执行被错误允许 | 低 | 极高 | 对抗性测试验证 |
| UNKNOWN 被自动重试 | 低 | 高 | 代码审查 + 测试 |

### 5.3 合规风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 违反平台规则 | 低 | 高 | 保守的安全策略 |
| 违反法律法规 | 极低 | 极高 | 人工监督 + 审核 |

---

## 六、质量保证

### 6.1 代码质量

- ✅ Typecheck 通过所有包
- ✅ 遵循项目代码风格
- ✅ 完整的 JSDoc 注释
- ✅ 清晰的错误信息

### 6.2 测试质量

- ✅ 单元测试覆盖所有场景
- ✅ 对抗性测试覆盖所有攻击向量
- ✅ 集成测试验证端到端流程
- ✅ 测试在个人电脑上运行

### 6.3 文档质量

- ✅ 完整的任务定义
- ✅ 详细的执行计划
- ✅ 清晰的审计报告
- ✅ 完整的授权包

---

## 七、交付物清单

### 7.1 代码交付物

- [ ] IdentityLock 验证审计报告
- [ ] Wrong-target gate 审计报告
- [ ] UNKNOWN 语义审计报告
- [ ] 对抗性测试套件
- [ ] 审计链审计报告

### 7.2 文档交付物

- [ ] SHEEP_312_TASK_DEFINITION.md
- [ ] SHEEP_312_EXECUTION_PLAN.md
- [ ] SHEEP_312_IDENTITY_LOCK_AUDIT.md
- [ ] SHEEP_312_WRONG_TARGET_AUDIT.md
- [ ] SHEEP_312_UNKNOWN_SEMANTICS_AUDIT.md
- [ ] SHEEP_312_AUDIT_CHAIN_AUDIT.md
- [ ] SHEEP_312_PRODUCTION_AUTHORIZATION_PACKAGE.md
- [ ] SHEEP_312_TASK_REPORT.md
- [ ] SHEEP_312_VALIDATION_REPORT.md

### 7.3 状态更新

- [ ] PROJECT_STATE.json 更新
- [ ] AUTO 授权保持 NOT_GRANTED

---

## 八、验收流程

### 8.1 内部验收

1. Codex 完成所有子任务
2. Typecheck 通过
3. 测试在个人电脑上运行
4. 文档完整

### 8.2 Controller 验收

1. Controller 审核任务报告
2. Controller 审核验证报告
3. Controller 审核授权包
4. Controller 决定 PASS 或 REPAIR

### 8.3 授权决策

1. Controller 审核授权包
2. Controller 决定是否授予 AUTO 生产授权
3. 如果授予，更新 PROJECT_STATE.json
4. 如果不授予，记录原因和建议

---

**计划人:** Codex AI Agent  
**审核人:** 待 Controller 审核  
**日期:** 2026-09-30
