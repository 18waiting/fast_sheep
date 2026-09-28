# Definition Consistency Audit — 2026-09-24

**Status:** OPEN — awaiting Controller review per issue  
**Created:** 2026-09-24  
**Scope:** Full project scan of TypeScript interfaces, Python models, SQL schemas, JSON Schemas, IPC channels, RPC methods, and governance documents  
**Method:** Systematic cross-layer naming and definition comparison

---

## Summary

| Severity | Count | Core Issues |
|----------|-------|-------------|
| 🔴 P0    | 3     | Shop/Store identity split, IdentityLock conflict, AI input format chaos |
| 🟠 P1    | 2     | Naming convention mixing, SQL↔TS mapping gaps |
| 🟡 P2    | 4     | Knowledge table collision, empty fact providers, data-flow gaps, legacy schema |
| 🔵 P3    | 3     | Stale docs, over-design, registry metadata |

**Total: 12 issues**

---

## 🔴 P0-1: "Shop" vs "Store" — Two Parallel Identity Models

### Problem

Two identity concepts (`shop` and `store`) coexist across the entire codebase with overlapping semantics but incompatible structures. Every layer uses a different term for what is conceptually the same thing: "a seller's selling point on a platform."

### Evidence

#### Layer 1: SQL Tables

**Legacy (migration 0001):**
```sql
-- resources/persistence/migrations/0001_initial.sql
CREATE TABLE shops (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  ...
);

CREATE TABLE products (
  product_id TEXT PRIMARY KEY,
  shop TEXT NOT NULL DEFAULT '',    -- references shops by name, not FK
  ...
);

CREATE TABLE conversations (
  ...
  shop_id TEXT NOT NULL,
  ...
);
```

**New identity domain (migration 0005):**
```sql
-- resources/persistence/migrations/0005_identity_domain.sql
CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  name TEXT NOT NULL,
  platform TEXT NOT NULL
);
```

**New commerce domain (migration 0007):**
```sql
-- resources/persistence/migrations/0007_commerce_domain.sql
-- NOTE: "customers/domain_products/orders have NO store_id (Store semantics DEFERRED)"
CREATE TABLE customers (
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  platform_account_id TEXT NOT NULL REFERENCES platform_accounts(id),
  ...
);
```

**New store knowledge (migration 0008):**
```sql
-- resources/persistence/migrations/0008_store_knowledge.sql
CREATE TABLE store_knowledge (
  ...
  merchant_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  ...
);
```

**Conflict:** `shops` (0001) and `stores` (0005) both exist. `conversations.shop_id` (0001) vs `store_knowledge.store_id` (0008).

#### Layer 2: TypeScript Interfaces

**Legacy ShopRecord:**
```typescript
// packages/persistence/src/repositories/shop-repository.ts
export interface ShopRecord {
  id: string;
  type: string;
  name: string;
  created_time?: string | null;
  enabled: boolean;
  order: number;
}
```

**New StoreRecord:**
```typescript
// packages/persistence/src/repositories/identity-repositories.ts
export interface StoreRecord {
  id: string;
  merchantId: string;
  name: string;
  platform: string;
}
```

**Conflict:** Different fields, different naming conventions, both actively used.

#### Layer 3: IPC Channels

**All orchestrator/platform commands use `shop_id`:**
```typescript
// apps/desktop/src/main/ipc/command-handlers.ts
[IPC.setMode]: ... async (req: { shop_id: string; ... })
[IPC.manualSend]: ... async (req: { shop_id: string; conversation_id: string })
[IPC.cancel]: ... async (req: { shop_id: string; conversation_id: string })
[IPC.focus]: ... async (req: { shop_id: string })
[IPC.platformActivateShop]: ... async (req: { shop_id: string })
[IPC.platformSetViewBounds]: ... async (req: { shop_id: string; ... })
[IPC.platformReload]: ... async (req: { shop_id: string })
```

**Store knowledge uses `store_id`:**
```typescript
// apps/desktop/src/main/ipc/query-handlers.ts
[IPC.storeKnowledgeQuery]: ... async (req: { merchant_id: string; store_id: string; ... })
[IPC.storeKnowledgeList]: ... async (req: { merchant_id: string; store_id: string; ... })
```

**Conflict:** Same IPC boundary, two different terms for the same concept.

#### Layer 4: JSON Schemas

**conversation.schema.json uses `shop_id`:**
```json
// resources/contracts/schemas/domain/conversation.schema.json
{
  "required": ["conversation_id", "shop_id", "buyer", "state"],
  "properties": {
    "shop_id": { "type": "string" }
  }
}
```

**conversation-context.schema.json uses `shop_id`:**
```json
// resources/contracts/schemas/domain/conversation-context.schema.json
{
  "required": ["conversation_id", "shop_id", "buyer", "question"],
  "properties": {
    "shop_id": { "type": "string" }
  }
}
```

**conversation-engine-request.schema.json uses `shop_id`:**
```json
// resources/contracts/schemas/conversation/conversation-engine-request.schema.json
{
  "properties": {
    "shop_id": { "type": "string" }
  }
}
```

**ContextEnvelope schema uses `store_id`:**
```json
// resources/contracts/schemas/domain/context-envelope.schema.json
{
  "$defs": {
    "IdentityLock": {
      "required": ["merchant_id", "store_id", "platform", ...],
      "properties": {
        "store_id": { "type": "string" }
      }
    }
  }
}
```

**Store Knowledge schema uses `store_id`:**
```json
// resources/contracts/schemas/domain/store-knowledge.schema.json
{
  "required": ["merchant_id", "store_id", ...],
  "properties": {
    "store_id": { "type": "string" }
  }
}
```

**Conflict:** Old schemas use `shop_id`, new schemas use `store_id`.

#### Layer 5: IPC Channel Names

```typescript
// packages/desktop-ipc/src/channels.ts
export const IPC = {
  listShops: "shops.list",              // "shop"
  shopsChanged: "shops.changed",         // "shop"
  platformActivateShop: "platform.activate_shop",  // "shop"
  storeKnowledgeUpsert: "store_knowledge.upsert",  // "store"
  storeKnowledgeQuery: "store_knowledge.query",     // "store"
  ...
}
```

### Impact

- **Cross-layer data flow is broken.** A message arrives via `shop_id` in IPC, gets persisted with `shop_id` in conversations, but ContextEnvelope expects `store_id`. No mapping exists.
- **Two tables (`shops` and `stores`) represent the same concept.** Neither is clearly deprecated.
- **Schema validation will fail** if a ContextEnvelope is built from conversation data (field name mismatch).
- **All new features (SHEEP-305, SHEEP-306) use `store_id`**, but the entire existing IPC and conversation layer uses `shop_id`.

### Files Involved

| File | Term Used |
|------|-----------|
| `resources/persistence/migrations/0001_initial.sql` | `shops`, `shop_id` |
| `resources/persistence/migrations/0005_identity_domain.sql` | `stores`, `store_id` |
| `resources/persistence/migrations/0007_commerce_domain.sql` | `store_id` (deferred) |
| `resources/persistence/migrations/0008_store_knowledge.sql` | `store_id` |
| `packages/persistence/src/repositories/shop-repository.ts` | `ShopRecord` |
| `packages/persistence/src/repositories/identity-repositories.ts` | `StoreRecord` |
| `packages/persistence/src/sqlite/sqlite-shop-repository.ts` | `shops` table |
| `packages/persistence/src/sqlite/sqlite-identity-repositories.ts` | `stores` table |
| `packages/desktop-ipc/src/channels.ts` | mixed |
| `apps/desktop/src/main/ipc/command-handlers.ts` | `shop_id` |
| `apps/desktop/src/main/ipc/query-handlers.ts` | mixed |
| `resources/contracts/schemas/domain/conversation.schema.json` | `shop_id` |
| `resources/contracts/schemas/domain/conversation-context.schema.json` | `shop_id` |
| `resources/contracts/schemas/conversation/conversation-engine-request.schema.json` | `shop_id` |
| `resources/contracts/schemas/domain/context-envelope.schema.json` | `store_id` |
| `resources/contracts/schemas/domain/store-knowledge.schema.json` | `store_id` |

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Unify on `store`** — deprecate `shops` table, rename `shop_id` → `store_id` everywhere
2. **Define clear semantics** — `shop` = legacy runtime concept, `store` = canonical identity concept, with explicit mapping
3. **Something else** — requires product/architecture decision

---

## 🔴 P0-2: IdentityLock — Two Incompatible Definitions

### Problem

The concept of "identity lock" (immutable identity scope for a conversation/envelope) is defined twice with incompatible shapes. Any code that tries to pass identity from the turn builder to the context envelope will fail.

### Evidence

#### Definition A: InboundTurnIdentityLock (SHEEP-303, TypeScript)

```typescript
// apps/desktop/src/main/services/inbound-turn-builder.ts
export interface InboundTurnScope {
  readonly merchantId: string | null;
  readonly storeId: string | null;
  readonly platformAccountId: string | null;
}

// (used by the turn builder for aggregation scope)
```

Also related — canonical persistence identity lock:
```typescript
// apps/desktop/src/main/services/canonical-inbound-persistence.ts
// Uses: lock.merchantId, lock.storeId, lock.platformAccountId
// All camelCase, all string (not nullable in resolved form)
const merchantId = String(lock.merchantId.value);
const storeId = String(lock.storeId.value);
const platformAccountId = String(lock.platformAccountId.value);
const conversationId = String(lock.internalConversationId.value);
```

**Shape A (camelCase, flat):**
```
{
  merchantId: string,
  storeId: string,
  platformAccountId: string,
  conversationId: string
}
```

#### Definition B: ContextEnvelope.IdentityLock (SHEEP-306, JSON Schema)

```json
// resources/contracts/schemas/domain/context-envelope.schema.json
"IdentityLock": {
  "type": "object",
  "required": [
    "merchant_id",
    "store_id",
    "platform",
    "platform_account_id",
    "customer_identity",
    "conversation_id",
    "trigger_message_id"
  ],
  "properties": {
    "merchant_id": { "type": "string" },
    "store_id": { "type": "string" },
    "platform": { "$ref": "fastwork:common:platform" },
    "platform_account_id": { "type": "string" },
    "customer_identity": {
      "type": "object",
      "required": ["kind", "value"],
      "properties": {
        "kind": { "enum": ["customerUid", "buyer_id", "user_id"] },
        "value": { "type": "string" }
      }
    },
    "conversation_id": { "type": "string" },
    "trigger_message_id": { "type": "string" },
    "generation": { "type": "integer" }
  }
}
```

**Shape B (snake_case, nested customer_identity, extra fields):**
```
{
  merchant_id: string,
  store_id: string,
  platform: string,
  platform_account_id: string,
  customer_identity: { kind: string, value: string },
  conversation_id: string,
  trigger_message_id: string,
  generation?: integer
}
```

### Differences

| Aspect | Shape A (TS code) | Shape B (JSON Schema) |
|--------|-------------------|----------------------|
| Naming | camelCase | snake_case |
| Customer | `customerId: string \| null` (or absent) | `customer_identity: { kind, value }` |
| Platform | not present as field | `platform` (required) |
| Trigger message | not present | `trigger_message_id` (required) |
| Generation | not present | `generation` (optional) |
| Nullability | some fields nullable | all required, no nulls |

### Impact

- **No code can construct a valid ContextEnvelope from InboundTurn data** without an explicit adapter/mapper.
- **No adapter/mapper exists.**
- **Schema validation will reject** any identity lock built from the TS code's shape.
- **The customer identity structure is fundamentally different:** flat string vs typed kind/value pair.

### Files Involved

| File | Definition |
|------|-----------|
| `apps/desktop/src/main/services/inbound-turn-builder.ts` | InboundTurnScope (camelCase, flat) |
| `apps/desktop/src/main/services/canonical-inbound-persistence.ts` | Identity lock usage (camelCase) |
| `resources/contracts/schemas/domain/context-envelope.schema.json` | IdentityLock (snake_case, nested) |
| `resources/contracts/schemas/domain/reply-plan.schema.json` | References IdentityLock via context-envelope |

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Unify on one canonical IdentityLock shape** — update both TS code and JSON Schema
2. **Define two shapes with explicit mapper** — InboundTurnScope is internal; IdentityLock is the canonical cross-boundary shape; add a builder
3. **Something else** — requires architecture decision

---

## 🔴 P0-3: AI Input — Three Competing Request Formats

### Problem

Three different schemas/code paths describe "input to AI generation." None of them match, and no bridge code exists between them.

### Evidence

#### Format A: ConversationEngineRequest (legacy, actually used)

```json
// resources/contracts/schemas/conversation/conversation-engine-request.schema.json
{
  "$id": "fastwork:conversation:conversation-engine-request",
  "required": ["question"],
  "properties": {
    "question": { "type": "string" },
    "product_id": { "type": "string" },
    "order_state": { "enum": ["未下单", "已下单"] },
    "chat_history": { "array" },
    "completed_question": { "type": "string" },
    "product_info": { "type": "string" },
    "buyer": { "type": "string" },
    "shop_id": { "type": "string" },
    "correlation_id": { "type": "string" },
    "context": { "$ref": "fastwork:domain:conversation-context" }
  }
}
```

**Used by:** `conversation.generate` RPC method -> `ConversationEngine.generate()`

#### Format B: GenerationRequest (defined, never used)

```json
// resources/contracts/schemas/domain/generation-request.schema.json
{
  "$id": "fastwork:domain:generation-request",
  "required": ["request_id", "messages"],
  "properties": {
    "request_id": { "type": "string" },
    "messages": { "array of {role, content}" },
    "tools": { "array" },
    "provider_ref": { "type": "string" },
    "max_tokens": { "type": "integer" },
    "temperature": { "type": "number" },
    "thinking": { "type": "boolean" },
    "timeout_ms": { "type": "integer" },
    "cancellation_token": { "type": "string" }
  }
}
```

**Used by:** Nothing. No code references this schema.

#### Format C: ContextEnvelope (defined in SHEEP-306, no consumer)

```json
// resources/contracts/schemas/domain/context-envelope.schema.json
{
  "$id": "fastwork:domain:context-envelope",
  "required": ["envelope_id", "conversation_id", "identity_lock", "scene", "trigger_message", "created_at"],
  "properties": {
    "envelope_id": { "type": "string" },
    "conversation_id": { "type": "string" },
    "identity_lock": { "$ref": "#/$defs/IdentityLock" },
    "scene": { "type": "string" },
    "trigger_message": { "$ref": "#/$defs/TriggerMessage" },
    "authoritative_facts": { "$ref": "#/$defs/AuthoritativeFacts" },
    "retrieved_knowledge": { "array" },
    "conversation_context": { "array" },
    "explicit_unknowns": { "array" },
    "created_at": { "date-time" }
  }
}
```

**Used by:** Nothing. No builder creates it. No consumer reads it.

### The Gap

```
What exists:
  InboundTurn -> SceneClassification -> [GAP] -> AI Worker -> [GAP]
                                            ^              ^
                                      ContextEnvelope   ReplyPlan
                                      (defined,         (defined,
                                       no builder)       no consumer)

What actually runs:
  conversation.generate RPC -> ConversationEngineRequest -> ConversationEngine -> text response
```

**Missing bridges:**
1. SceneClassification -> ContextEnvelope Builder (who constructs the envelope?)
2. ContextEnvelope -> ConversationEngineRequest or GenerationRequest (how does the AI worker consume it?)
3. AI text response -> ReplyPlan (how does the response become a structured plan?)

### Impact

- **ContextEnvelope and ReplyPlan are paper contracts** — they define the target architecture but have no runtime connection.
- **The actual AI path** still uses the legacy `ConversationEngineRequest` with `shop_id`, `buyer`, `question` fields.
- **SHEEP-307 (next task)** will need to bridge ContextEnvelope -> AI Worker, but the target format is unclear.
- **Three formats create confusion** about which is canonical.

### Files Involved

| File | Format | Status |
|------|--------|--------|
| `resources/contracts/schemas/conversation/conversation-engine-request.schema.json` | A | Active (used by RPC) |
| `resources/contracts/schemas/domain/generation-request.schema.json` | B | Orphaned (never used) |
| `resources/contracts/schemas/domain/context-envelope.schema.json` | C | Defined, no builder/consumer |
| `resources/contracts/schemas/domain/reply-plan.schema.json` | Output | Defined, no producer/consumer |
| `services/ai-worker/src/fastwork_ai_worker/rpc/methods/conversation.py` | Consumes A | Active |
| `services/ai-worker/src/fastwork_ai_worker/conversation/composition.py` | Builds engine for A | Active |
| `docs/architecture/REPLY_PLAN_EVOLUTION.md` | Describes C -> ReplyPlan | Architecture doc only |

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Deprecate A and B, build bridge to C** — ContextEnvelope becomes canonical; adapter converts it to whatever the AI Worker needs
2. **Keep A as runtime format, C as architecture target** — explicit adapter from C -> A for now
3. **Merge A and C** — extend ConversationEngineRequest with identity_lock, facts, etc.
4. **Something else** — requires architecture decision

---

## 🟠 P1-1: TypeScript Naming Convention — camelCase vs snake_case Mixing

### Problem

TypeScript code within the same project uses both camelCase and snake_case for the same concepts, with no documented convention.

### Evidence

| File | Convention | Fields |
|------|-----------|--------|
| `packages/persistence/src/repositories/identity-repositories.ts` | camelCase | `StoreRecord.merchantId`, `StoreRecord.platform` |
| `apps/desktop/src/main/services/store-knowledge-service.ts` | snake_case | `StoreKnowledgeEntry.merchant_id`, `store_id`, `knowledge_type` |
| `apps/desktop/src/main/services/canonical-inbound-persistence.ts` | camelCase | `conversationId`, `merchantId`, `storeId` |
| `apps/desktop/src/main/ipc/command-handlers.ts` | snake_case | `req.shop_id`, `req.conversation_id` |
| `apps/desktop/src/main/ipc/query-handlers.ts` | mixed | reads `c.storeId` (camelCase), outputs `{ store_id: ... }` (snake_case) |
| `packages/persistence/src/repositories/product-repository.ts` | snake_case | `ProductRecord.product_id` |
| `packages/persistence/src/repositories/shop-repository.ts` | mixed | `ShopRecord.created_time` (snake) but `ShopRecord.order` |

### Impact

- **Cognitive overhead** — developers must check each file's convention.
- **Serialization bugs** — when data crosses boundaries (e.g., IPC -> service), field names may not match.
- **No lint rule enforces consistency.**

### Resolution Direction (NOT YET DECIDED)

Options:
1. **All camelCase** — TypeScript convention; map to snake_case only at SQL/JSON boundaries
2. **All snake_case** — match SQL/Python; unusual for TypeScript
3. **Boundary convention** — camelCase internally, snake_case at IPC/JSON/SQL boundaries (document and enforce)

---

## 🟠 P1-2: SQL <-> TypeScript Mapping — No Unified Layer

### Problem

SQL columns use `snake_case` (`merchant_id`, `store_id`), TypeScript interfaces use `camelCase` (`merchantId`, `storeId`). Row-to-interface mapping is done ad-hoc in scattered `mapRow()` functions with no shared utility.

### Evidence

**SQL (snake_case):**
```sql
-- resources/persistence/migrations/0005_identity_domain.sql
CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  name TEXT NOT NULL,
  platform TEXT NOT NULL
);
```

**TypeScript (camelCase):**
```typescript
// packages/persistence/src/repositories/identity-repositories.ts
export interface StoreRecord { id: string; merchantId: string; name: string; platform: string; }
```

**Ad-hoc mapping:**
```typescript
// packages/persistence/src/sqlite/sqlite-identity-repositories.ts
const r = this.conn.get<StoreRow>("SELECT id, merchant_id, name, platform FROM stores WHERE id = ?", id);
// Mapping happens implicitly via field name aliasing or manual mapping
```

**Another example (store-knowledge-service.ts):**
```typescript
function mapRow(row: Record<string, unknown>): StoreKnowledgeEntry {
  return {
    id: row.id as string,
    merchant_id: row.merchant_id as string,   // stays snake_case
    store_id: row.store_id as string,
    ...
  };
}
```

### Impact

- **Mapping errors** — easy to miss a field or misspell during mapping.
- **No compile-time safety** — mapping is runtime, untyped.
- **Inconsistent patterns** — some services use `mapRow()`, others inline the mapping.

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Shared mapper utility** — generic `mapSnakeToCamel<T>(row): T`
2. **SQL aliases** — `SELECT merchant_id AS "merchantId"` at query time
3. **Accept snake_case in TS** — align with SQL/Python

---

## 🟡 P2-1: Knowledge Table Collision — Four "Knowledge" Concepts

### Problem

Four different tables/concepts all use the word "knowledge" with unclear boundaries.

### Evidence

| Table | Migration | Purpose | Active? |
|-------|-----------|---------|---------|
| `knowledge_entries` | 0001 | Legacy knowledge base (imported from original product) | Yes |
| `knowledge_candidates` | 0001 | Learning pipeline candidates (pending review) | Yes |
| `pending_knowledge` | 0003 | Learning review/audit queue | Yes |
| `store_knowledge` | 0008 | SHEEP-305 Store Knowledge (DEC-008 layer 3) | Yes |

**Additional confusion:**
```typescript
// apps/desktop/src/main/services/store-knowledge-service.ts
// Uses store_knowledge table

// services/ai-worker/src/fastwork_ai_worker/persistence/store_knowledge_repository.py
// Also uses store_knowledge table

// But knowledge_entries is used by:
// services/ai-worker/src/fastwork_ai_worker/rag/ (RAG engine)
// services/ai-worker/src/fastwork_ai_worker/legacy_import/ (legacy import)
```

### Impact

- **Developers cannot tell which "knowledge" table to use** for a given feature.
- **`knowledge_entries` vs `store_knowledge`** — are they the same concept? Is one replacing the other? No documentation says.
- **RAG engine indexes `knowledge_entries`**, but SHEEP-305 writes to `store_knowledge`. Are they connected?

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Rename for clarity** — `knowledge_entries` -> `legacy_knowledge`, `store_knowledge` -> `store_rules`
2. **Define hierarchy** — document which table serves which DEC-008 layer
3. **Consolidate** — merge tables where appropriate

---

## 🟡 P2-2: Authoritative Facts — 4 of 5 Types Have No Data Source

### Problem

ContextEnvelope defines 5 types of `authoritative_facts`, but only 1 has a data source.

### Evidence

```json
// resources/contracts/schemas/domain/context-envelope.schema.json
"AuthoritativeFacts": {
  "properties": {
    "shop_facts": { ... },         // No service provides this
    "product_facts": { ... },      // No service provides this
    "order_facts": { ... },        // No service provides this
    "logistics_facts": { ... },    // No service provides this
    "knowledge_facts": { ... }     // Store Knowledge (SHEEP-305)
  }
}
```

**Database tables exist but have no fact-provider services:**
- `customers` table (0007) -> no `customer_facts` provider
- `domain_products` table (0007) -> no `product_facts` provider
- `orders` table (0007) -> no `order_facts` provider
- `logistics` table (0007) -> no `logistics_facts` provider

### Impact

- **ContextEnvelope is mostly empty** when constructed — 80% of facts are undefined.
- **Schema promises capabilities that don't exist.**
- **AI generation cannot use facts that aren't provided.**

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Implement fact providers** — one service per fact type (large effort)
2. **Reduce schema** — only define facts that have providers; add others later
3. **Mark as optional** — make all fact types optional in schema; document which are implemented

---

## 🟡 P2-3: Data Flow Gaps — Missing Builders and Bridges

### Problem

The architecture defines a pipeline, but critical components are missing.

### Evidence

```
Defined pipeline:
  InboundTurn -> SceneClassification -> ContextEnvelope -> AI Worker -> ReplyPlan -> Send

What exists:
  [OK] InboundTurn (SHEEP-303, in-memory)
  [OK] SceneClassification (SHEEP-304, in-memory)
  [MISSING] ContextEnvelope Builder — who constructs it?
  [MISSING] ContextEnvelope -> AI Worker bridge — AI Worker accepts ConversationEngineRequest or messages[], not ContextEnvelope
  [MISSING] ReplyPlan producer — AI Worker returns text, not ReplyPlan
  [MISSING] ReplyPlan -> Send bridge — no code consumes ReplyPlan
```

**AI Worker input (what it actually accepts):**
```python
# services/ai-worker/src/fastwork_ai_worker/rpc/methods/conversation.py
async def generate(self, req: Dict[str, Any]) -> Dict[str, Any]:
    payload = req.get("payload") or {}
    _validate("fastwork:conversation:conversation-engine-request", payload)
    result = self._get_engine().generate(payload)
    return result
```

**ConversationEngineRequest expects:**
```json
{ "question": "...", "shop_id": "...", "buyer": "...", "chat_history": [...], ... }
```

**ContextEnvelope provides:**
```json
{ "envelope_id": "...", "identity_lock": {...}, "trigger_message": {...}, "authoritative_facts": {...}, ... }
```

**No adapter converts ContextEnvelope -> ConversationEngineRequest.**

### Impact

- **SHEEP-307 (next task) cannot proceed** without deciding how to bridge this gap.
- **ContextEnvelope and ReplyPlan are architectural aspirations**, not runtime artifacts.

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Build ContextEnvelope -> ConversationEngineRequest adapter** — translate new format to legacy format
2. **Extend AI Worker to accept ContextEnvelope** — add new RPC method or extend `conversation.generate`
3. **Build ContextEnvelope -> messages[] adapter** — convert envelope to LLM messages directly
4. **Something else** — requires architecture decision

---

## 🟡 P2-4: Legacy conversation-engine-request Uses Outdated Fields

### Problem

The actively-used `conversation-engine-request` schema uses fields that don't match the current identity model.

### Evidence

```json
// resources/contracts/schemas/conversation/conversation-engine-request.schema.json
{
  "properties": {
    "shop_id": { "type": "string" },     // Should be store_id?
    "buyer": { "type": "string" },       // Not in identity model
    "product_id": { "type": "string" },  // OK
    "order_state": { "enum": ["未下单", "已下单"] }  // Simplistic
  }
}
```

**Missing from this schema:**
- `merchant_id` (required by identity model)
- `platform_account_id` (required by identity model)
- `customer_identity` (structured, from ContextEnvelope)
- `identity_lock` (immutable scope)

### Impact

- **AI generation lacks identity context** — doesn't know which merchant/store/account.
- **Cannot enforce tenant isolation** at the AI layer.
- **Incompatible with ContextEnvelope's identity model.**

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Extend schema** — add `merchant_id`, `platform_account_id`, `identity_lock`
2. **Replace schema** — deprecate `conversation-engine-request`, use ContextEnvelope
3. **Adapter layer** — build ContextEnvelope -> conversation-engine-request adapter that extracts needed fields

---

## 🔵 P3-1: Stale Documents in project/ Directory

### Problem

Several large documents in `project/` are historical artifacts that may confuse future development.

### Evidence

| File | Size | Issue |
|------|------|-------|
| `project/SHEEP_301_READINESS_REVIEW.md` | 16 KB | Historical audit for completed task |
| `project/SHEEP_301_REAL_PRODUCER_READINESS_AUDIT.md` | 90 KB | Historical audit for completed task |
| `project/FAST_SHEEP_CODING_ROADMAP.md` | 22 KB | No version suffix — is this current or V1.0? |
| `project/FAST_SHEEP_CODEX_TASK_TEMPLATE.md` | 11 KB | No version suffix — is this current or V1.0? |

**Active governance documents (per AGENTS.md):**
- `project/FAST_SHEEP_MASTER_PROMPT.md` — constitution
- `project/DECISIONS.md` — locked decisions
- `project/FAST_SHEEP_CODING_ROADMAP_V1.1_REVIEWED.md` — current roadmap
- `project/FAST_SHEEP_CODEX_TASK_TEMPLATE_V1.1_REVIEWED.md` — current template
- `project/PROJECT_STATE.json` — current state

**Ambiguous documents:**
- `FAST_SHEEP_CODING_ROADMAP.md` vs `FAST_SHEEP_CODING_ROADMAP_V1.1_REVIEWED.md` — which is authoritative?
- `FAST_SHEEP_CODEX_TASK_TEMPLATE.md` vs `FAST_SHEEP_CODEX_TASK_TEMPLATE_V1.1_REVIEWED.md` — which is authoritative?

### Impact

- **Developers may read the wrong document.**
- **106 KB of historical audit reports clutter the project root.**
- **Ambiguous filenames create uncertainty about authority.**

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Archive** — move historical docs to `project/archive/`
2. **Delete** — remove if truly obsolete
3. **Rename** — add `_HISTORICAL` or `_SUPERSEDED` suffix to ambiguous files

---

## 🔵 P3-2: customer_identity Over-Design for MVP-A

### Problem

ContextEnvelope's `customer_identity.kind` supports three platforms, but MVP-A only targets PDD.

### Evidence

```json
// resources/contracts/schemas/domain/context-envelope.schema.json
"customer_identity": {
  "type": "object",
  "required": ["kind", "value"],
  "properties": {
    "kind": {
      "type": "string",
      "enum": ["customerUid", "buyer_id", "user_id"]
      //     ^ PDD           ^ DouDian     ^ Xianyu/JD?
    },
    "value": { "type": "string" }
  }
}
```

**MVP-A scope (per PDD_MVP_V1.md):**
- Platform: PDD only
- Customer identity: PDD `customerUid`

### Impact

- **Premature abstraction** — two of three enum values are unused in MVP-A.
- **Schema suggests capabilities that don't exist yet.**

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Keep as-is** — forward-compatible, no harm
2. **Reduce to PDD only** — `kind: { const: "customerUid" }`, extend later
3. **Document intent** — add comment explaining this is for future platforms

---

## 🔵 P3-3: Schema Registry Metadata Incomplete

### Problem

Newly registered schemas have empty `used_by` and `parity_behavior_ids` fields.

### Evidence

```json
// resources/contracts/schemas/registry.json
{
  "id": "fastwork:domain:store-knowledge",
  "owners": ["StoreKnowledgeService"],
  "used_by": [],                    // Empty
  "parity_behavior_ids": [],        // Empty
  ...
},
{
  "id": "fastwork:domain:context-envelope",
  "owners": ["SHEEP-306"],
  "used_by": [],                    // Empty
  "parity_behavior_ids": [],        // Empty
  ...
},
{
  "id": "fastwork:domain:reply-plan",
  "owners": ["SHEEP-306"],
  "used_by": [],                    // Empty
  "parity_behavior_ids": [],        // Empty
  ...
}
```

**Compare with mature schemas:**
```json
{
  "id": "fastwork:config:ai-config",
  "owners": ["SettingsRepository"],
  "used_by": ["behavior:B-PROMPT-001", "behavior:B-STORE-003"],
  "parity_behavior_ids": ["B-PROMPT-001", "B-STORE-003"],
  ...
}
```

### Impact

- **Registry doesn't show dependencies** — hard to trace which behaviors use which schemas.
- **Parity testing can't identify affected tests** when schemas change.

### Resolution Direction (NOT YET DECIDED)

Options:
1. **Update metadata** — populate `used_by` and `parity_behavior_ids` for new schemas
2. **Defer** — fill in when behaviors/parity tests are written
3. **Make optional** — document that these fields are optional for new schemas

---

## Next Steps

Each issue requires:
1. **Controller review** — confirm the problem statement is accurate
2. **Product/architecture decision** — choose resolution direction
3. **Implementation task** — create SHEEP task or fix PR
4. **Verification** — ensure fix doesn't break existing functionality

**Recommended order:**
1. P0-1 (Shop vs Store) — foundational, affects everything
2. P0-2 (IdentityLock) — blocks ContextEnvelope implementation
3. P0-3 (AI Input Formats) — blocks SHEEP-307
4. P1-1, P1-2 (Naming) — code quality, can be done incrementally
5. P2-1 through P2-4 — structural, requires design work
6. P3-1 through P3-3 — cleanup, low priority

---

**Audit completed:** 2026-09-24  
**Auditor:** Codex (full project scan)  
**Review authority:** Controller (per AGENTS.md section 4)
