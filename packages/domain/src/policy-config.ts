/**
 * Policy Configuration Domain (SHEEP-308).
 *
 * Governance basis:
 * - Master §5: AI output must be structured and governed.
 * - PDD_MVP_V1.md §4: Configuration Hierarchy (GLOBAL -> SHOP -> SCENE).
 * - REPLY_AND_ACTION_SAFETY: Deterministic policy evaluation.
 *
 * Key invariants:
 * - PolicyConfig defines the configuration hierarchy for RolloutMode resolution.
 * - Three levels: GLOBAL (default) -> SHOP (override) -> SCENE (override, MVP DEFERRED).
 * - Precedence: SCENE > SHOP > GLOBAL (MVP: SHOP > GLOBAL).
 * - Overrides are conditional and explicit.
 * - Configuration is deterministic and auditable.
 *
 * Owner SHEEP-308 decisions:
 * D1: MVP implements GLOBAL and SHOP levels only.
 * D2: SCENE level is DEFERRED to future work.
 * D3: Overrides are condition-based and explicit.
 *
 * **Contract Schema Types — Not Domain Layer Types**
 *
 * These TypeScript types mirror the JSON Schema definitions in
 * `resources/contracts/schemas/domain/policy-config.schema.json`.
 * They use flat strings with snake_case naming.
 */

import type { RolloutMode } from "./context-envelope.js";

/**
 * PolicyConfig: Configuration hierarchy for RolloutMode resolution.
 *
 * This interface defines the three-level configuration hierarchy:
 * - global: Default configuration for all shops
 * - shops: Shop-specific overrides (optional)
 * - scenes: Scene-specific overrides (optional, MVP DEFERRED)
 *
 * Precedence: SCENE > SHOP > GLOBAL (MVP: SHOP > GLOBAL)
 *
 * Usage:
 * ```typescript
 * const config: PolicyConfig = {
 *   global: {
 *     default_mode: "HUMAN_CONFIRM",
 *     overrides: [
 *       {
 *         condition: { risk_level: "high" },
 *         mode: "HUMAN_CONFIRM",
 *         reason: "High risk scenarios require human review"
 *       }
 *     ]
 *   },
 *   shops: {
 *     "shop_123": {
 *       default_mode: "SHADOW",
 *       overrides: []
 *     }
 *   }
 * };
 * ```
 */
export interface PolicyConfig {
  /**
   * Global default configuration.
   * Applied when no shop-specific or scene-specific override exists.
   * Required.
   */
  readonly global: RolloutModeConfig;

  /**
   * Shop-specific configuration overrides.
   * Key: shop_id (string)
   * Value: RolloutModeConfig for that shop
   * Optional. When absent, global config is used for all shops.
   */
  readonly shops?: Record<string, RolloutModeConfig>;

  /**
   * Scene-specific configuration overrides.
   * Key: scene name (string, e.g., "SHIPPING_TIME", "RETURN_POLICY")
   * Value: RolloutModeConfig for that scene
   * Optional. MVP DEFERRED - not implemented in v1.
   * When implemented, precedence: SCENE > SHOP > GLOBAL.
   */
  readonly scenes?: Record<string, RolloutModeConfig>;
}

/**
 * RolloutModeConfig: Configuration for a specific scope (global/shop/scene).
 *
 * Defines the default RolloutMode and optional conditional overrides.
 *
 * Usage:
 * ```typescript
 * const config: RolloutModeConfig = {
 *   default_mode: "HUMAN_CONFIRM",
 *   overrides: [
 *     {
 *       condition: { risk_level: "low", has_blocking_unknowns: false },
 *       mode: "AUTO",
 *       reason: "Low risk with no blocking unknowns"
 *     }
 *   ]
 * };
 * ```
 */
export interface RolloutModeConfig {
  /**
   * Default RolloutMode for this scope.
   * Used when no override conditions match.
   * Required.
   */
  readonly default_mode: RolloutMode;

  /**
   * Conditional overrides for this scope.
   * Evaluated in order; first match wins.
   * Optional. When absent or empty, default_mode is always used.
   */
  readonly overrides?: readonly RolloutModeOverride[];
}

/**
 * RolloutModeOverride: A conditional override for RolloutMode.
 *
 * When the condition matches, the specified mode is used instead of default_mode.
 *
 * Usage:
 * ```typescript
 * const override: RolloutModeOverride = {
 *   condition: {
 *     scene: "SHIPPING_TIME",
 *     risk_level: "low"
 *   },
 *   mode: "AUTO",
 *   reason: "Shipping time inquiries with low risk can auto-reply"
 * };
 * ```
 */
export interface RolloutModeOverride {
  /**
   * Condition that must match for this override to apply.
   * All specified fields must match (AND logic).
   * Required.
   */
  readonly condition: OverrideCondition;

  /**
   * RolloutMode to use when condition matches.
   * Required.
   */
  readonly mode: RolloutMode;

  /**
   * Human-readable reason for this override.
   * Used for audit and debugging.
   * Required.
   */
  readonly reason: string;
}

/**
 * OverrideCondition: Condition for applying a RolloutMode override.
 *
 * All specified fields must match (AND logic).
 * Unspecified fields are ignored (wildcard).
 *
 * Usage:
 * ```typescript
 * // Match any scenario with high risk
 * const condition1: OverrideCondition = {
 *   risk_level: "high"
 * };
 *
 * // Match SHIPPING_TIME scene with low risk and no blocking unknowns
 * const condition2: OverrideCondition = {
 *   scene: "SHIPPING_TIME",
 *   risk_level: "low",
 *   has_blocking_unknowns: false
 * };
 * ```
 */
export interface OverrideCondition {
  /**
   * Scene name to match (e.g., "SHIPPING_TIME", "RETURN_POLICY").
   * Optional. When specified, only applies to this scene.
   * MVP DEFERRED: Scene-level overrides not implemented in v1.
   */
  readonly scene?: string;

  /**
   * Risk level to match.
   * Optional. When specified, only applies to this risk level.
   */
  readonly risk_level?: "low" | "medium" | "high";

  /**
   * Whether blocking unknowns must be present/absent.
   * Optional. When specified:
   * - true: condition matches only if blocking unknowns are present
   * - false: condition matches only if no blocking unknowns are present
   */
  readonly has_blocking_unknowns?: boolean;
}

/**
 * Helper function to create a minimal PolicyConfig with only global defaults.
 *
 * Use this for simple configurations where no shop-specific overrides are needed.
 *
 * @param defaultMode - The default RolloutMode
 * @returns PolicyConfig with only global configuration
 *
 * @example
 * ```typescript
 * const config = createSimplePolicyConfig("HUMAN_CONFIRM");
 * // config.global.default_mode === "HUMAN_CONFIRM"
 * // config.shops === undefined
 * ```
 */
export function createSimplePolicyConfig(defaultMode: RolloutMode): PolicyConfig {
  return {
    global: {
      default_mode: defaultMode,
    },
  };
}

/**
 * Helper function to create a PolicyConfig with shop-specific overrides.
 *
 * Use this when different shops need different RolloutMode configurations.
 *
 * @param globalDefault - The global default RolloutMode
 * @param shopConfigs - Map of shop_id to RolloutModeConfig
 * @returns PolicyConfig with global and shop-level configurations
 *
 * @example
 * ```typescript
 * const config = createShopPolicyConfig("HUMAN_CONFIRM", {
 *   "shop_123": { default_mode: "SHADOW" },
 *   "shop_456": { default_mode: "AUTO" }
 * });
 * ```
 */
export function createShopPolicyConfig(
  globalDefault: RolloutMode,
  shopConfigs: Record<string, RolloutModeConfig>,
): PolicyConfig {
  return {
    global: {
      default_mode: globalDefault,
    },
    shops: shopConfigs,
  };
}
