// M11 persistence main-import-writer adapter (clean-room). Writes ONLY Main-owned
// aggregates via the M1 repositories. Conflicts default to PRESERVE_EXISTING.
import type { MainImportWriterPort, MainWriteResult } from "../ports/main-import-writer.js";
import type { SourceItemRef, TargetAggregate, LegacyImportOptions, ImportItemManifest } from "../types.js";
import { resolveConflict, DEFAULT_CONFLICT_POLICY } from "../conflict-policy.js";
import type {
  ShopRepository, SettingsRepository, ProductRepository, PromptRepository,
  SkillRepository, TransferRuleRepository, ForbiddenWordRepository, ConversationRepository,
} from "@fastwork/persistence";

export interface PersistenceMainImportWriterOptions {
  shops: ShopRepository;
  settings: SettingsRepository;
  products: ProductRepository;
  prompts: PromptRepository;
  skills: SkillRepository;
  transferRules: TransferRuleRepository;
  forbiddenWords: ForbiddenWordRepository;
  conversations: ConversationRepository;
  /** Optional raw connection for idempotency checks (message import). */
  conn?: { get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined };
}

export class PersistenceMainImportWriter implements MainImportWriterPort {
  constructor(private readonly deps: PersistenceMainImportWriterOptions) {}

  async write(item: SourceItemRef, parsed: unknown, manifest: ImportItemManifest, options: LegacyImportOptions): Promise<MainWriteResult> {
    const policy = options.conflict_policy ?? DEFAULT_CONFLICT_POLICY;
    switch (manifest.target_aggregate) {
      case "shops": return this.writeShops(parsed, policy);
      case "config_groups": return this.writeSettings(parsed, policy);
      case "products": return this.writeProducts(parsed, policy);
      case "prompt_profiles": return this.writePrompts(parsed, policy);
      case "skills": return this.writeSkills(parsed, policy);
      case "product_skill_mounts": return this.writeMounts(parsed, policy);
      case "transfer_rules": return this.writeTransferRules(parsed, policy);
      case "forbidden_words": return this.writeForbiddenWords(parsed, policy);
      case "conversations": return this.writeMessages(parsed, policy);
      default: return { aggregate: manifest.target_aggregate, inserted: 0, skipped: 0, replaced: 0 };
    }
  }

  hasIdentity(aggregate: TargetAggregate, identity: string): boolean {
    switch (aggregate) {
      case "shops": return this.deps.shops.list().some((s) => s.id === identity);
      case "products": return this.deps.products.get(identity) !== undefined;
      case "prompt_profiles": return this.deps.prompts.get(identity) !== undefined;
      case "skills": return this.deps.skills.get(identity) !== undefined;
      case "config_groups": return this.deps.settings.getGroup(identity) !== undefined;
      default: return false;
    }
  }

  foreignRefsValid(aggregate: TargetAggregate, refs: string[]): boolean {
    if (aggregate !== "product_skill_mounts") return true;
    return refs.every((id) => this.deps.skills.get(id) !== undefined);
  }

  private writeShops(parsed: unknown, policy: string): MainWriteResult {
    const shops = ((parsed as { shops?: Array<Record<string, unknown>> }).shops ?? []) as Array<{ id: string; type: string; name: string; enabled: boolean; order: number }>;
    let inserted = 0, skipped = 0;
    for (const s of shops) {
      const decision = resolveConflict(this.deps.shops.list().find((x) => x.id === s.id), s, policy as never);
      if (decision.action === "skip") { skipped++; continue; }
      this.deps.shops.add({ id: s.id, type: s.type, name: s.name, created_time: null, enabled: s.enabled, order: s.order });
      inserted++;
    }
    return { aggregate: "shops", inserted, skipped, replaced: 0 };
  }

  private writeSettings(parsed: unknown, policy: string): MainWriteResult {
    const result = parsed as { group?: string; payload?: Record<string, unknown>; groups?: Array<{ group: string; payload: Record<string, unknown> }> };
    let inserted = 0, skipped = 0;
    const groups = result.groups ?? (result.group && result.payload ? [{ group: result.group, payload: result.payload }] : []);
    for (const g of groups) {
      const decision = resolveConflict(this.deps.settings.getGroup(g.group), g.payload, policy as never);
      if (decision.action === "skip") { skipped++; continue; }
      const existing = this.deps.settings.getGroup(g.group) as Record<string, unknown> | undefined;
      const merged = decision.action === "merge" && existing ? { ...existing, ...g.payload } : g.payload;
      this.deps.settings.setGroup(g.group, merged);
      inserted++;
    }
    return { aggregate: "config_groups", inserted, skipped, replaced: 0 };
  }

  private writeProducts(parsed: unknown, policy: string): MainWriteResult {
    const products = ((parsed as { products?: Array<Record<string, unknown>> }).products ?? []) as Array<{ product_id: string; title: string; detail: string; shop: string; note: string }>;
    let inserted = 0, skipped = 0;
    for (const p of products) {
      if (!p.product_id) continue;
      const existing = this.deps.products.get(p.product_id);
      if (existing && policy === "PRESERVE_EXISTING") { skipped++; continue; }
      if (existing && existing.detail && p.detail && policy !== "REPLACE_SELECTED") { skipped++; continue; }
      this.deps.products.save({ product_id: p.product_id, title: p.title, detail: p.detail, shop: p.shop, note: p.note });
      inserted++;
    }
    return { aggregate: "products", inserted, skipped, replaced: 0 };
  }

  private writePrompts(parsed: unknown, policy: string): MainWriteResult {
    const result = parsed as { prompts: Array<{ id: string; title: string; content: string; order_status_binding: string; mounted_skills: string[] }>; active_ids: Record<string, string> };
    let inserted = 0, skipped = 0;
    for (const p of result.prompts ?? []) {
      if (!p.id) continue;
      const decision = resolveConflict(this.deps.prompts.get(p.id), p, policy as never);
      if (decision.action === "skip") { skipped++; continue; }
      this.deps.prompts.save({ id: p.id, title: p.title, content: p.content, order_status_binding: p.order_status_binding ?? "all", mounted_skills: p.mounted_skills ?? [] });
      inserted++;
    }
    return { aggregate: "prompt_profiles", inserted, skipped, replaced: 0 };
  }

  private writeSkills(parsed: unknown, policy: string): MainWriteResult {
    const skill = (parsed as { skill?: Record<string, unknown> }).skill;
    if (!skill || !String(skill.skill_id)) return { aggregate: "skills", inserted: 0, skipped: 0, replaced: 0 };
    const existing = this.deps.skills.get(String(skill.skill_id));
    if (existing && policy === "PRESERVE_EXISTING") return { aggregate: "skills", inserted: 0, skipped: 1, replaced: 0 };
    this.deps.skills.save({
      skill_id: String(skill.skill_id), name: String(skill.name), enabled: false,
      asset_path: String(skill.asset_path), signature: null,
      metadata: (skill.metadata as Record<string, unknown>) ?? {},
    });
    return { aggregate: "skills", inserted: 1, skipped: 0, replaced: 0 };
  }

  private writeMounts(parsed: unknown, policy: string): MainWriteResult {
    const mounts = (parsed as Record<string, unknown>) ?? {};
    let inserted = 0, skipped = 0;
    for (const [productId, skillNames] of Object.entries(mounts)) {
      if (!Array.isArray(skillNames)) continue;
      for (const name of skillNames) {
        const skill = this.deps.skills.list().find((s) => s.name === String(name));
        if (!skill) { skipped++; continue; }
        this.deps.skills.mountToProduct(productId, skill.skill_id);
        inserted++;
      }
    }
    return { aggregate: "product_skill_mounts", inserted, skipped, replaced: 0 };
  }

  private writeTransferRules(parsed: unknown, policy: string): MainWriteResult {
    const result = parsed as { rows: Array<Record<string, unknown>>; migrated_column: boolean };
    let inserted = 0;
    for (const r of result.rows ?? []) {
      this.deps.transferRules.save({
        keyword: String(r.keyword), transfer_to: String(r.transfer_to), transfer_message: String(r.transfer_message),
        work_hours: String(r.work_hours), source_agent: String(r.source_agent), status: String(r.status),
        order_state: String(r.order_state), applicable_shops: String(r.applicable_shops), sort_order: 0, enabled: String(r.status) !== "禁用",
      });
      inserted++;
    }
    return { aggregate: "transfer_rules", inserted, skipped: 0, replaced: 0 };
  }

  private writeForbiddenWords(parsed: unknown, policy: string): MainWriteResult {
    const words = ((parsed as { words?: Array<Record<string, unknown>> }).words ?? []) as Array<{ term: string; replacement: string }>;
    let inserted = 0;
    for (const w of words) {
      if (!w.term) continue;
      this.deps.forbiddenWords.save({ term: w.term, replacement: w.replacement, enabled: true, sort_order: 0 });
      inserted++;
    }
    return { aggregate: "forbidden_words", inserted, skipped: 0, replaced: 0 };
  }

  private writeMessages(parsed: unknown, policy: string): MainWriteResult {
    const result = parsed as { rows: Array<{ product_id: string; time: string; buyer_name: string; question: string; ai_reply: string; chat_history: string; highest_similarity: string; agent_name: string }> };
    let inserted = 0, skipped = 0;
    const now = new Date().toISOString();
    const conn = this.deps.conn;
    for (const r of result.rows ?? []) {
      if (!r.buyer_name && !r.question) continue;
      const convId = "conv-import-" + r.buyer_name + "-" + r.time.replace(/[^0-9]/g, "");
      const messageId = "msg-import-" + hashId(convId + "|" + r.time + "|" + r.question).slice(0, 24);
      if (conn) {
        const existing = conn.get<{ message_id: string }>("SELECT message_id FROM conversation_messages WHERE message_id = ?", messageId);
        if (existing) { skipped++; continue; }
      }
      this.deps.conversations.ensureConversation({ conversation_id: convId, shop_id: r.agent_name || "import", buyer: r.buyer_name || "买家", started_at: r.time || now, updated_at: r.time || now, state: "active" });
      this.deps.conversations.appendMessage({
        message_id: messageId,
        conversation_id: convId, shop_id: r.agent_name || "import", platform: "import", buyer: r.buyer_name || "买家",
        type: "text", content: r.question + "\n" + r.ai_reply, role: "ai",
        created_at: r.time || now, metadata: { import: true, highest_similarity: r.highest_similarity, product_id: r.product_id },
      });
      inserted++;
    }
    return { aggregate: "conversations", inserted, skipped, replaced: 0 };
  }

}

function hashId(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) - h + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36) + "-" + value.length.toString(36);
}
