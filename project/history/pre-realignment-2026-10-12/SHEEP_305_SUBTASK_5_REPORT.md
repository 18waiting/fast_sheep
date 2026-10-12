# SHEEP-305 子任务 5 完成报告：TypeScript 类型定义对齐

**任务 ID:** SHEEP-305  
**子任务:** 5 - TypeScript 侧类型定义对齐  
**状态:** ✅ COMPLETE  
**日期:** 2026-09-29  
**工作量:** 0.5 天（计划）/ 实际完成

---

## 📋 目标

在 TypeScript 侧定义与 Python 侧 `scene_knowledge_mapping.py` 对应的类型和函数，确保跨语言边界类型安全。

---

## ✅ 验收标准完成情况

| # | 验收标准 | 状态 | 证据 |
|---|---------|------|------|
| AC-5.1 | 类型定义与 Python 侧一致 | ✅ | 映射表完全一致，复用 context-envelope 已有类型 |
| AC-5.2 | `getKnowledgeFilter("SHIPPING_TIME")` 返回正确映射 | ✅ | 返回 `{ knowledgeType: "STORE_RULE", storeKnowledgeType: "SHIPPING_TIME" }` |
| AC-5.3 | `getKnowledgeFilter(undefined)` 返回默认 | ✅ | 返回 `{ knowledgeType: "ALL", storeKnowledgeType: undefined }` |
| AC-5.4 | typecheck 通过 | ✅ | `pnpm run typecheck` 全部通过 |
| AC-5.5 | 从 domain 包导出 | ✅ | `index.ts` 添加 `export * from "./knowledge.js"` |

---

## 🔧 修改详情

### 新增文件：`packages/domain/src/knowledge.ts`

**关键设计决策：**

1. **复用已有类型**：
   - 发现 `context-envelope.ts` 已定义 `KnowledgeType` 和 `StoreKnowledgeType`
   - 不重新定义，而是 `import type` 复用
   - 避免命名冲突（TS2308 错误）

2. **扩展 KnowledgeFilterType**：
   - 新增 `KnowledgeFilterType = KnowledgeType | "ALL"`
   - "ALL" 是哨兵值，表示"不过滤"
   - 与 Python 侧 `knowledge_type="ALL"` 语义一致

3. **KnowledgeFilter 接口**：
   ```typescript
   interface KnowledgeFilter {
     knowledgeType: KnowledgeFilterType;      // "ALL" | "STORE_RULE" | "PRODUCT_KNOWLEDGE"
     storeKnowledgeType: StoreKnowledgeType | undefined;  // "SHIPPING_TIME" | ... | undefined
   }
   ```

4. **核心函数**：
   - `getKnowledgeFilter(scene)` — 场景到过滤器的映射
   - `isRecognizedScene(scene)` — 类型守卫
   - `getAllScenes()` — 获取所有已识别场景
   - `isDefaultFilter(filter)` — 检查是否为默认（不过滤）状态

5. **映射表**（与 Python 完全一致）：
   ```typescript
   SHIPPING_TIME → { knowledgeType: "STORE_RULE", storeKnowledgeType: "SHIPPING_TIME" }
   RETURN_POLICY → { knowledgeType: "STORE_RULE", storeKnowledgeType: "RETURN_POLICY" }
   PRODUCT_INQUIRY → { knowledgeType: "PRODUCT_KNOWLEDGE", storeKnowledgeType: undefined }
   FAQ → { knowledgeType: "STORE_RULE", storeKnowledgeType: "FAQ" }
   默认 → { knowledgeType: "ALL", storeKnowledgeType: undefined }
   ```

### 修改文件：`packages/domain/src/index.ts`

- **新增导出**（第 118 行）：
  ```typescript
  // SHEEP-305: Knowledge type filtering for scene-based RAG routing.
  export * from "./knowledge.js";
  ```

---

## 🔗 跨语言一致性

### Python 侧（子任务 3）
```python
SCENE_KNOWLEDGE_MAPPING = {
    "SHIPPING_TIME": ("STORE_RULE", "SHIPPING_TIME"),
    "RETURN_POLICY": ("STORE_RULE", "RETURN_POLICY"),
    "PRODUCT_INQUIRY": ("PRODUCT_KNOWLEDGE", None),
    "FAQ": ("STORE_RULE", "FAQ"),
}
DEFAULT_MAPPING = ("ALL", None)
```

### TypeScript 侧（子任务 5）
```typescript
SCENE_KNOWLEDGE_MAPPING = {
  SHIPPING_TIME: { knowledgeType: "STORE_RULE", storeKnowledgeType: "SHIPPING_TIME" },
  RETURN_POLICY: { knowledgeType: "STORE_RULE", storeKnowledgeType: "RETURN_POLICY" },
  PRODUCT_INQUIRY: { knowledgeType: "PRODUCT_KNOWLEDGE", storeKnowledgeType: undefined },
  FAQ: { knowledgeType: "STORE_RULE", storeKnowledgeType: "FAQ" },
}
DEFAULT_FILTER = { knowledgeType: "ALL", storeKnowledgeType: undefined }
```

**一致性：** ✅ 完全对齐

---

## 📊 影响范围

### 新增的文件
1. `packages/domain/src/knowledge.ts`

### 修改的文件
1. `packages/domain/src/index.ts`

### 依赖关系
- **依赖：** `context-envelope.ts`（复用 KnowledgeType, StoreKnowledgeType）
- **被依赖：** 子任务 6（Builder 集成）

---

## ⚠️ 风险和注意事项

### 1. 类型同步维护
- **风险：** Python 和 TypeScript 映射表需要手动同步
- **缓解：** 两侧映射表集中管理，注释标注同步要求
- **状态：** CONFIRMED

### 2. "ALL" 哨兵值
- **风险：** "ALL" 不在 contract KnowledgeType 中，仅在 filter 层使用
- **缓解：** 使用 KnowledgeFilterType 扩展类型，明确区分
- **状态：** CONFIRMED

---

## 📝 下一步工作

### 子任务 6：Builder 集成真实知识检索
- **目标：** 在 context-envelope-builder 中集成真实知识检索
- **文件：** 
  - `apps/desktop/src/main/adapters/rpc-store-knowledge-retrieval.ts`
  - `apps/desktop/src/main/services/context-envelope-builder.ts`
- **工作量：** 1.5 天
- **内容：**
  - 实现 RpcStoreKnowledgeRetrieval 类
  - 替换 stub 为真实 RPC 调用
  - 传递场景过滤参数
  - 错误处理和优雅降级

---

## ✅ 完成声明

**子任务 5 状态：** COMPLETE

**验证结果：**
- ✅ 所有验收标准满足
- ✅ typecheck 全部通过
- ✅ 与 Python 侧映射一致
- ✅ 复用已有类型，无冲突
- ✅ 从 domain 包正确导出
- ✅ 文档完整

**下一步：** 子任务 6 - Builder 集成真实知识检索

---

**报告生成时间：** 2026-09-29  
**报告生成人：** Codex  
**审核状态：** 待 Controller 审核
