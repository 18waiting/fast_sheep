/**
 * RolloutModeResolver Tests (SHEEP-308).
 *
 * DEFERRED: These tests require Node.js v22+ (--experimental-strip-types).
 * Run on personal computer (Windows, E:\fast_sheep\).
 *
 * Test command: pnpm run test apps/desktop/tests/rollout-mode-resolver.test.ts
 */

import { describe, it, expect } from "vitest";
import { RolloutModeResolver } from "../src/main/services/rollout-mode-resolver.js";
import type { PolicyConfig } from "@fastwork/domain";

describe("RolloutModeResolver", () => {
  describe("global default", () => {
    it("returns global default when no overrides", () => {
      const config: PolicyConfig = {
        global: { default_mode: "HUMAN_CONFIRM" },
      };
      const resolver = new RolloutModeResolver(config);
      const result = resolver.resolve({ shop_id: "shop_123" });
      expect(result.mode).toBe("HUMAN_CONFIRM");
      expect(result.source).toBe("global");
    });

    it("returns OFF when global default is OFF", () => {
      const config: PolicyConfig = {
        global: { default_mode: "OFF" },
      };
      const resolver = new RolloutModeResolver(config);
      const result = resolver.resolve({ shop_id: "shop_123" });
      expect(result.mode).toBe("OFF");
      expect(result.source).toBe("global");
    });
  });

  describe("shop-level override", () => {
    it("returns shop override when configured", () => {
      const config: PolicyConfig = {
        global: { default_mode: "HUMAN_CONFIRM" },
        shops: {
          "shop_123": { default_mode: "SHADOW" },
        },
      };
      const resolver = new RolloutModeResolver(config);
      const result = resolver.resolve({ shop_id: "shop_123" });
      expect(result.mode).toBe("SHADOW");
      expect(result.source).toBe("shop");
      expect(result.shop_id).toBe("shop_123");
    });

    it("falls back to global for unconfigured shop", () => {
      const config: PolicyConfig = {
        global: { default_mode: "HUMAN_CONFIRM" },
        shops: {
          "shop_123": { default_mode: "SHADOW" },
        },
      };
      const resolver = new RolloutModeResolver(config);
      const result = resolver.resolve({ shop_id: "shop_456" });
      expect(result.mode).toBe("HUMAN_CONFIRM");
      expect(result.source).toBe("global");
    });
  });

  describe("conditional overrides", () => {
    it("applies override when scene matches", () => {
      const config: PolicyConfig = {
        global: { default_mode: "HUMAN_CONFIRM" },
        shops: {
          "shop_123": {
            default_mode: "SHADOW",
            overrides: [
              {
                condition: { scene: "REFUND" },
                mode: "HUMAN_CONFIRM",
                reason: "Refund requires human confirmation",
              },
            ],
          },
        },
      };
      const resolver = new RolloutModeResolver(config);
      const result = resolver.resolve({ shop_id: "shop_123", scene: "REFUND" });
      expect(result.mode).toBe("HUMAN_CONFIRM");
      expect(result.source).toBe("override");
      expect(result.override_reason).toBe("Refund requires human confirmation");
    });

    it("applies override when risk_level matches", () => {
      const config: PolicyConfig = {
        global: { default_mode: "SHADOW" },
        shops: {
          "shop_123": {
            default_mode: "SHADOW",
            overrides: [
              {
                condition: { risk_level: "high" },
                mode: "HUMAN_CONFIRM",
                reason: "High risk requires human confirmation",
              },
            ],
          },
        },
      };
      const resolver = new RolloutModeResolver(config);
      const result = resolver.resolve({ shop_id: "shop_123", risk_level: "high" });
      expect(result.mode).toBe("HUMAN_CONFIRM");
      expect(result.source).toBe("override");
    });

    it("applies override when has_blocking_unknowns matches", () => {
      const config: PolicyConfig = {
        global: { default_mode: "SHADOW" },
        shops: {
          "shop_123": {
            default_mode: "SHADOW",
            overrides: [
              {
                condition: { has_blocking_unknowns: true },
                mode: "OFF",
                reason: "Blocking unknowns prevent execution",
              },
            ],
          },
        },
      };
      const resolver = new RolloutModeResolver(config);
      const result = resolver.resolve({ shop_id: "shop_123", has_blocking_unknowns: true });
      expect(result.mode).toBe("OFF");
      expect(result.source).toBe("override");
    });

    it("ignores override when condition does not match", () => {
      const config: PolicyConfig = {
        global: { default_mode: "HUMAN_CONFIRM" },
        shops: {
          "shop_123": {
            default_mode: "HUMAN_CONFIRM",
            overrides: [
              {
                condition: { scene: "REFUND" },
                mode: "OFF",
                reason: "Refund blocked",
              },
            ],
          },
        },
      };
      const resolver = new RolloutModeResolver(config);
      const result = resolver.resolve({ shop_id: "shop_123", scene: "SHIPPING" });
      expect(result.mode).toBe("HUMAN_CONFIRM");
      expect(result.source).toBe("shop"); // Falls back to shop default
    });
  });

  describe("AND logic for conditions", () => {
    it("applies override only when ALL conditions match", () => {
      const config: PolicyConfig = {
        global: { default_mode: "HUMAN_CONFIRM" },
        shops: {
          "shop_123": {
            default_mode: "HUMAN_CONFIRM",
            overrides: [
              {
                condition: { scene: "REFUND", risk_level: "high" },
                mode: "OFF",
                reason: "High-risk refund blocked",
              },
            ],
          },
        },
      };
      const resolver = new RolloutModeResolver(config);

      // Both match
      const result1 = resolver.resolve({ shop_id: "shop_123", scene: "REFUND", risk_level: "high" });
      expect(result1.mode).toBe("OFF");

      // Only scene matches
      const result2 = resolver.resolve({ shop_id: "shop_123", scene: "REFUND", risk_level: "low" });
      expect(result2.mode).toBe("HUMAN_CONFIRM");
    });
  });
});
