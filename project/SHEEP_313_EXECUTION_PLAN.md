# SHEEP-313 执行计划 — 多店铺扩展验证

**任务定义:** `project/SHEEP_313_TASK_DEFINITION.md`  
**依赖:** SHEEP-312 ✅  
**预计工期:** 7 天  
**创建日期:** 2026-09-30  

---

## 执行策略

```
子任务 1: 隔离机制审计（先审计现有代码，找出已实现和未实现的隔离机制）
    ↓
子任务 2: 测试基础设施（创建双店铺测试 fixture 和 helper）
    ↓
子任务 3: 并发 + 会话隔离测试（EC-1, EC-2）
    ↓
子任务 4: 知识 + 发送隔离测试（EC-3, EC-4）
    ↓
子任务 5: 审计 + 故障隔离测试（EC-5, EC-6）
    ↓
子任务 6: 配置 + 对抗性测试（EC-7, EC-8）
    ↓
子任务 7: 任务报告 + PROJECT_STATE 更新
```

---

## 子任务 1: 隔离机制审计

**目标:** 审计现有代码中的隔离机制，找出已实现和未实现的隔离点  
**预计时间:** 0.5 天  
**退出标准:** 审计报告完成，列出所有隔离点和风险

### 1.1 审计范围

| 审计项 | 文件 | 关注点 |
|--------|------|--------|
| 运行时状态隔离 | `conversation-orchestrator.ts` | Map key 是否包含 shopId |
| 发送序列化隔离 | `send-serializer.ts` | 队列 key 是否包含 shopId |
| 身份锁定隔离 | `human-confirm-controller.ts` | IdentityLock 是否包含 merchant_id + store_id |
| 持久化隔离 | `sqlite-conversation-repositories.ts` | SQL 查询是否按 store_id 过滤 |
| 知识隔离 | `knowledge.ts` | 知识查询是否有 store 维度过滤 |
| 审计隔离 | `audit-correlation.ts` | 审计记录是否包含 shop_id |
| IPC 路由隔离 | `channels.ts` | IPC 调用是否按 shopId 路由 |

### 1.2 交付物

- `project/SHEEP_313_ISOLATION_AUDIT.md` — 隔离机制审计报告

### 1.3 验收标准

- [ ] 每个隔离点都有代码位置引用
- [ ] 每个隔离点标注 ✅ 已实现 / ⚠️ 需验证 / ❌ 未实现
- [ ] 风险点有明确描述和建议

---

## 子任务 2: 测试基础设施

**目标:** 创建双店铺测试 fixture 和 helper 函数  
**预计时间:** 0.5 天  
**依赖:** 子任务 1  
**退出标准:** 测试基础设施可复用，所有后续测试都使用统一 fixture

### 2.1 测试 Fixture 设计

```typescript
// 两个独立的测试店铺
const shopA: TestShop = {
  merchant_id: "merchant-1",
  store_id: "store-A",
  platform: "pdd",
  platform_account_id: "pa-A",
  customer_identity: { kind: "customerUid", value: "customer-A" },
};

const shopB: TestShop = {
  merchant_id: "merchant-1",  // 同一商户
  store_id: "store-B",        // 不同店铺
  platform: "pdd",
  platform_account_id: "pa-B",
  customer_identity: { kind: "customerUid", value: "customer-B" },
};

// 跨商户测试（不同商户的店铺）
const shopC: TestShop = {
  merchant_id: "merchant-2",  // 不同商户
  store_id: "store-C",
  platform: "pdd",
  platform_account_id: "pa-C",
  customer_identity: { kind: "customerUid", value: "customer-C" },
};
```

### 2.2 Helper 函数

- `createDualShopController()` — 创建支持双店铺的控制器
- `createTestMessage(shop, customer, content)` — 创建测试消息
- `assertNoCrossShopLeak(actual, expectedShop)` — 断言无跨店铺泄漏
- `createIsolatedDatabase()` — 创建隔离的测试数据库

### 2.3 交付物

- `packages/orchestrator/tests/fixtures/multi-shop-fixtures.ts`
- `packages/domain/tests/fixtures/multi-shop-fixtures.ts`

### 2.4 验收标准

- [ ] Fixture 覆盖同商户多店铺 + 跨商户场景
- [ ] Helper 函数可复用
- [ ] typecheck 通过

---

## 子任务 3: 并发 + 会话隔离测试 (EC-1, EC-2)

**目标:** 验证运行时状态和会话的隔离性  
**预计时间:** 1 天  
**依赖:** 子任务 2  
**退出标准:** 并发测试和会话隔离测试全部通过

### 3.1 EC-1: 并发运行隔离测试

| 测试场景 | 验证内容 |
|----------|----------|
| 双店铺并发处理 100 条消息 | 无串店，状态独立 |
| 双店铺并发发送 | 发送队列独立 |
| 双店铺并发 AI 结果 | 结果路由正确 |
| Map key 冲突检测 | `shopId\0conversationId` 唯一性 |

### 3.2 EC-2: 会话/客户隔离测试

| 测试场景 | 验证内容 |
|----------|----------|
| 相同 buyer_id 在不同店铺 | 创建不同会话 |
| 消息路由正确性 | 消息进入正确店铺的会话 |
| 会话状态独立 | 一个店铺的会话状态不影响另一个 |
| 会话列表隔离 | 查询只显示本店铺的会话 |

### 3.3 交付物

- `packages/orchestrator/tests/multi-shop-concurrency.test.ts`
- `packages/orchestrator/tests/multi-shop-conversation.test.ts`

### 3.4 验收标准

- [ ] 并发测试 4 个场景全部通过
- [ ] 会话隔离测试 4 个场景全部通过
- [ ] typecheck 通过

---

## 子任务 4: 知识 + 发送隔离测试 (EC-3, EC-4)

**目标:** 验证知识库和发送操作的隔离性  
**预计时间:** 1 天  
**依赖:** 子任务 2  
**退出标准:** 知识隔离和发送隔离测试全部通过

### 4.1 EC-3: 知识/RAG 隔离测试

| 测试场景 | 验证内容 |
|----------|----------|
| 店铺知识查询隔离 | Shop-A 查询不到 Shop-B 的知识 |
| 知识类型过滤隔离 | 按 storeKnowledgeType 过滤正确 |
| 知识写入隔离 | Shop-A 写入的知识不影响 Shop-B |
| 知识删除隔离 | Shop-A 删除的知识不影响 Shop-B |

### 4.2 EC-4: 发送隔离测试

| 测试场景 | 验证内容 |
|----------|----------|
| 跨店铺发送被拒绝 | IdentityLock 验证拦截 |
| 跨店铺确认被拒绝 | HumanConfirmController 拒绝 |
| 跨店铺 wrong-target 被拒绝 | WrongTargetValidator 拦截 |
| 跨店铺 binding 被拒绝 | BindingValidator 拦截 |

### 4.3 交付物

- `packages/domain/tests/multi-shop-knowledge.test.ts`
- `packages/orchestrator/tests/multi-shop-send.test.ts`

### 4.4 验收标准

- [ ] 知识隔离测试 4 个场景全部通过
- [ ] 发送隔离测试 4 个场景全部通过
- [ ] typecheck 通过

---

## 子任务 5: 审计 + 故障隔离测试 (EC-5, EC-6)

**目标:** 验证审计记录和故障恢复的隔离性  
**预计时间:** 1 天  
**依赖:** 子任务 2  
**退出标准:** 审计隔离和故障隔离测试全部通过

### 5.1 EC-5: 审计/交接隔离测试

| 测试场景 | 验证内容 |
|----------|----------|
| 审计记录按 shop_id 隔离 | 查询只返回本店铺记录 |
| 审计链 shop_id 一致性 | 所有事件共享相同 shop_id |
| 审计完成状态隔离 | Shop-A 完成不影响 Shop-B |
| 审计查询不返回跨店铺记录 | 隔离查询正确 |

### 5.2 EC-6: 故障/恢复隔离测试

| 测试场景 | 验证内容 |
|----------|----------|
| Shop-A 异常不影响 Shop-B | 故障不传播 |
| Shop-A 超时不影响 Shop-B | 超时不传播 |
| Shop-A 取消不影响 Shop-B | 取消操作隔离 |
| Shop-A 数据库错误不影响 Shop-B | 数据库错误隔离 |

### 5.3 交付物

- `packages/domain/tests/multi-shop-audit.test.ts`
- `packages/orchestrator/tests/multi-shop-failure.test.ts`

### 5.4 验收标准

- [ ] 审计隔离测试 4 个场景全部通过
- [ ] 故障隔离测试 4 个场景全部通过
- [ ] typecheck 通过

---

## 子任务 6: 配置 + 对抗性测试 (EC-7, EC-8)

**目标:** 验证配置隔离和跨店铺攻击防御  
**预计时间:** 1.5 天  
**依赖:** 子任务 3, 4, 5  
**退出标准:** 配置隔离和对抗性测试全部通过

### 6.1 EC-7: 配置隔离测试

| 测试场景 | 验证内容 |
|----------|----------|
| rollout_mode 配置隔离 | 不同店铺不同模式 |
| 过期时间配置隔离 | 不同店铺不同过期时间 |
| 策略版本配置隔离 | 不同店铺不同策略版本 |
| 配置变更不传播 | 修改一个店铺配置不影响其他 |

### 6.2 EC-8: 跨商户对抗性测试

| 测试场景 | 验证内容 |
|----------|----------|
| 跨商户数据查询攻击 | 被隔离机制拦截 |
| 跨商户发送操作攻击 | 被 IdentityLock 拦截 |
| 跨商户配置修改攻击 | 被权限检查拦截 |
| 跨商户审计访问攻击 | 被审计隔离拦截 |
| 组合攻击：跨商户 + 跨店铺 | 多层防御都生效 |
| 重放攻击：旧店铺上下文 | 被 generation 检查拦截 |
| 身份欺骗攻击 | 被 customer_identity 验证拦截 |

### 6.3 交付物

- `packages/orchestrator/tests/multi-shop-config.test.ts`
- `packages/orchestrator/tests/multi-shop-adversarial.test.ts`

### 6.4 验收标准

- [ ] 配置隔离测试 4 个场景全部通过
- [ ] 对抗性测试 15+ 个场景全部通过
- [ ] typecheck 通过

---

## 子任务 7: 任务报告 + PROJECT_STATE 更新

**目标:** 编写最终任务报告，更新项目状态  
**预计时间:** 0.5 天  
**依赖:** 子任务 1~6  
**退出标准:** 报告完成，PROJECT_STATE 更新

### 7.1 交付物

- `project/SHEEP_313_TASK_REPORT.md` — 最终任务报告
- `project/PROJECT_STATE.json` — 更新 SHEEP-313 状态

### 7.2 报告内容

- 8 项退出标准的验证结果
- 发现的隔离问题和风险
- 测试覆盖统计
- 个人电脑测试要求
- 治理证据总结

### 7.3 验收标准

- [ ] 报告覆盖所有 8 项退出标准
- [ ] 所有测试结果记录完整
- [ ] PROJECT_STATE 更新正确

---

## 执行顺序依赖图

```
子任务 1 (审计)
    ↓
子任务 2 (基础设施)
    ↓
    ├── 子任务 3 (并发 + 会话)  ──┐
    ├── 子任务 4 (知识 + 发送)  ──┤── 子任务 6 (配置 + 对抗)
    └── 子任务 5 (审计 + 故障)  ──┘         ↓
                                      子任务 7 (报告)
```

---

## 测试统计

| 子任务 | 测试数量 | 覆盖退出标准 |
|--------|----------|-------------|
| 子任务 3 | 8 | EC-1, EC-2 |
| 子任务 4 | 8 | EC-3, EC-4 |
| 子任务 5 | 8 | EC-5, EC-6 |
| 子任务 6 | 19 | EC-7, EC-8 |
| **总计** | **43+** | **8/8** |

---

## 环境约束

- **开发环境:** macOS, Node.js v20
- **验证标准:** `pnpm run typecheck` 通过
- **单元测试:** 标记为 `DEFERRED: 需要在个人电脑上运行`
- **个人电脑:** Windows, Node.js v22+, 路径 `E:\fast_sheep\`

---

**文档版本:** 1.0  
**创建日期:** 2026-09-30  
**状态:** PLANNED
