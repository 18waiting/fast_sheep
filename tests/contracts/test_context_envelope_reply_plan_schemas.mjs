// SHEEP-306: ContextEnvelope and ReplyPlan schema validation tests
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA_ROOT = resolve(process.cwd(), "resources/contracts/schemas");

function loadSchema(path) {
  return JSON.parse(readFileSync(resolve(SCHEMA_ROOT, path), "utf-8"));
}

describe("SHEEP-306: ContextEnvelope and ReplyPlan schemas", () => {
  describe("ContextEnvelope schema", () => {
    it("loads valid JSON schema", () => {
      const schema = loadSchema("domain/context-envelope.schema.json");
      assert.ok(schema.$schema);
      assert.equal(schema.$id, "fastwork:domain:context-envelope");
      assert.equal(schema.$title, "ContextEnvelope");
      assert.equal(schema.type, "object");
    });

    it("has required fields", () => {
      const schema = loadSchema("domain/context-envelope.schema.json");
      const required = schema.required;
      assert.ok(required.includes("envelope_id"));
      assert.ok(required.includes("conversation_id"));
      assert.ok(required.includes("identity_lock"));
      assert.ok(required.includes("scene"));
      assert.ok(required.includes("trigger_message"));
      assert.ok(required.includes("created_at"));
    });

    it("defines IdentityLock with required fields", () => {
      const schema = loadSchema("domain/context-envelope.schema.json");
      const identityLock = schema.$defs.IdentityLock;
      assert.ok(identityLock);
      assert.equal(identityLock.type, "object");
      const required = identityLock.required;
      assert.ok(required.includes("merchant_id"));
      assert.ok(required.includes("store_id"));
      assert.ok(required.includes("platform"));
      assert.ok(required.includes("platform_account_id"));
      assert.ok(required.includes("customer_identity"));
      assert.ok(required.includes("conversation_id"));
      assert.ok(required.includes("trigger_message_id"));
    });

    it("defines AuthoritativeFacts with provenanced facts", () => {
      const schema = loadSchema("domain/context-envelope.schema.json");
      const facts = schema.$defs.AuthoritativeFacts;
      assert.ok(facts);
      assert.ok(facts.properties.shop_facts);
      assert.ok(facts.properties.product_facts);
      assert.ok(facts.properties.order_facts);
      assert.ok(facts.properties.logistics_facts);
      assert.ok(facts.properties.knowledge_facts);
    });

    it("defines ProvenancedFact with source and provenance", () => {
      const schema = loadSchema("domain/context-envelope.schema.json");
      const fact = schema.$defs.ProvenancedFact;
      assert.ok(fact);
      assert.ok(fact.properties.value);
      assert.ok(fact.properties.source);
      assert.ok(fact.properties.provenance);
      const sources = fact.properties.source.enum;
      assert.ok(sources.includes("platform_api"));
      assert.ok(sources.includes("store_knowledge"));
    });

    it("defines RetrievedKnowledge for Store Knowledge (SHEEP-305)", () => {
      const schema = loadSchema("domain/context-envelope.schema.json");
      const knowledge = schema.$defs.RetrievedKnowledge;
      assert.ok(knowledge);
      assert.ok(knowledge.properties.knowledge_id);
      assert.ok(knowledge.properties.knowledge_type);
      const types = knowledge.properties.knowledge_type.enum;
      assert.ok(types.includes("SHIPPING_TIME"));
      assert.ok(types.includes("RETURN_POLICY"));
      assert.ok(types.includes("FAQ"));
    });

    it("defines ExplicitUnknown for blocking unknowns", () => {
      const schema = loadSchema("domain/context-envelope.schema.json");
      const unknown = schema.$defs.ExplicitUnknown;
      assert.ok(unknown);
      assert.ok(unknown.properties.unknown_id);
      assert.ok(unknown.properties.category);
      assert.ok(unknown.properties.blocking);
      const categories = unknown.properties.category.enum;
      assert.ok(categories.includes("missing_identity"));
      assert.ok(categories.includes("missing_fact"));
      assert.ok(categories.includes("contradictory_facts"));
    });
  });

  describe("ReplyPlan schema", () => {
    it("loads valid JSON schema", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      assert.ok(schema.$schema);
      assert.equal(schema.$id, "fastwork:domain:reply-plan");
      assert.equal(schema.$title, "ReplyPlan");
      assert.equal(schema.type, "object");
    });

    it("has required fields", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      const required = schema.required;
      assert.ok(required.includes("plan_id"));
      assert.ok(required.includes("envelope_ref"));
      assert.ok(required.includes("identity_lock"));
      assert.ok(required.includes("scene"));
      assert.ok(required.includes("trigger_message"));
      assert.ok(required.includes("reply_content"));
      assert.ok(required.includes("verification_requirements"));
      assert.ok(required.includes("created_at"));
    });

    it("references ContextEnvelope IdentityLock", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      const identityLock = schema.properties.identity_lock;
      assert.ok(identityLock.$ref);
      assert.ok(identityLock.$ref.includes("context-envelope"));
      assert.ok(identityLock.$ref.includes("IdentityLock"));
    });

    it("defines ReplyContent with text and segments", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      const content = schema.$defs.ReplyContent;
      assert.ok(content);
      assert.ok(content.properties.text);
      assert.ok(content.properties.language);
      assert.ok(content.properties.segments);
    });

    it("defines FactReference for authoritative facts", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      const factRef = schema.$defs.FactReference;
      assert.ok(factRef);
      assert.ok(factRef.properties.fact_id);
      assert.ok(factRef.properties.fact_key);
      assert.ok(factRef.properties.source);
      assert.ok(factRef.properties.value_snapshot);
    });

    it("defines KnowledgeReference for Store Knowledge (SHEEP-305)", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      const knowledgeRef = schema.$defs.KnowledgeReference;
      assert.ok(knowledgeRef);
      assert.ok(knowledgeRef.properties.knowledge_id);
      assert.ok(knowledgeRef.properties.knowledge_type);
      assert.ok(knowledgeRef.properties.relevance_score);
    });

    it("defines InferenceReference to distinguish AI inference from facts", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      const inferenceRef = schema.$defs.InferenceReference;
      assert.ok(inferenceRef);
      assert.ok(inferenceRef.properties.inference_id);
      assert.ok(inferenceRef.properties.inference_type);
      assert.ok(inferenceRef.properties.confidence);
      const types = inferenceRef.properties.inference_type.enum;
      assert.ok(types.includes("intent_classification"));
      assert.ok(types.includes("entity_extraction"));
    });

    it("defines PolicyMetadata with rollout mode", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      const policy = schema.$defs.PolicyMetadata;
      assert.ok(policy);
      assert.ok(policy.properties.rollout_mode);
      const modes = policy.properties.rollout_mode.enum;
      assert.ok(modes.includes("SHADOW"));
      assert.ok(modes.includes("HUMAN_CONFIRM"));
      assert.ok(modes.includes("AUTO"));
    });

    it("defines VerificationRequirements for pre-execution checks", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      const verification = schema.$defs.VerificationRequirements;
      assert.ok(verification);
      assert.ok(verification.properties.identity_lock_valid);
      assert.ok(verification.properties.facts_validated);
      assert.ok(verification.properties.required_verifications);
    });

    it("defines PlanUnknown for execution-blocking unknowns", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      const unknown = schema.$defs.PlanUnknown;
      assert.ok(unknown);
      assert.ok(unknown.properties.unknown_id);
      assert.ok(unknown.properties.category);
      assert.ok(unknown.properties.blocking);
      assert.ok(unknown.properties.mitigation);
    });
  });

  describe("Schema cross-references", () => {
    it("ReplyPlan references ContextEnvelope IdentityLock", () => {
      const replyPlan = loadSchema("domain/reply-plan.schema.json");
      const contextEnvelope = loadSchema("domain/context-envelope.schema.json");
      
      const identityLockRef = replyPlan.properties.identity_lock.$ref;
      assert.ok(identityLockRef.includes("context-envelope"));
      
      // Verify the referenced definition exists
      const identityLockDef = contextEnvelope.$defs.IdentityLock;
      assert.ok(identityLockDef);
    });

    it("ReplyPlan references ContextEnvelope TriggerMessage", () => {
      const replyPlan = loadSchema("domain/reply-plan.schema.json");
      const contextEnvelope = loadSchema("domain/context-envelope.schema.json");
      
      const triggerRef = replyPlan.properties.trigger_message.$ref;
      assert.ok(triggerRef.includes("context-envelope"));
      
      // Verify the referenced definition exists
      const triggerDef = contextEnvelope.$defs.TriggerMessage;
      assert.ok(triggerDef);
    });
  });

  describe("Architecture invariants", () => {
    it("ContextEnvelope has identity_lock as structural requirement", () => {
      const schema = loadSchema("domain/context-envelope.schema.json");
      assert.ok(schema.required.includes("identity_lock"));
    });

    it("ReplyPlan distinguishes facts, knowledge, and inference", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      assert.ok(schema.properties.fact_references);
      assert.ok(schema.properties.knowledge_references);
      assert.ok(schema.properties.inference_references);
    });

    it("ReplyPlan has explicit unknowns", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      assert.ok(schema.properties.unknowns);
    });

    it("ReplyPlan has verification requirements", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      assert.ok(schema.required.includes("verification_requirements"));
    });

    it("ProvenancedFact requires source and provenance", () => {
      const schema = loadSchema("domain/context-envelope.schema.json");
      const fact = schema.$defs.ProvenancedFact;
      assert.ok(fact.required.includes("value"));
      assert.ok(fact.required.includes("source"));
      assert.ok(fact.required.includes("provenance"));
    });

    it("InferenceReference requires confidence to distinguish from facts", () => {
      const schema = loadSchema("domain/reply-plan.schema.json");
      const inference = schema.$defs.InferenceReference;
      assert.ok(inference.required.includes("confidence"));
    });
  });
});
