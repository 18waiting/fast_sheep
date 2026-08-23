// M11 secret policy (clean-room). Provider/model API secrets are SKIP by default;
// explicit consent moves them to a SecretStore as credential_ref only. Seller
// cookies/session tokens/passwords/auth state are NEVER imported.
import type { LegacyImportOptions } from "./types.js";

export const SELLER_SECRET_FIELDS = [
  "cookie", "cookies", "session", "session_token", "token", "password", "passwd",
  "auth", "authorization", "device_fingerprint", "license", "login_state", "credential",
];

export const PROVIDER_SECRET_FIELDS = [
  "api_key", "apiKey", "apikey", "secret", "secret_key", "access_key", "app_secret",
];

export interface SecretDetection {
  secret_fields_detected: string[];
  seller_secrets_detected: string[];
  provider_secrets_detected: string[];
  plaintext_must_not_persist: string[];
}

/** Detect secret-like keys (values are never returned — only key names). */
export function detectSecrets(obj: unknown, depth = 0): SecretDetection {
  const out: SecretDetection = { secret_fields_detected: [], seller_secrets_detected: [], provider_secrets_detected: [], plaintext_must_not_persist: [] };
  if (depth > 32 || obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = detectSecrets(item, depth + 1);
      mergeDetection(out, r);
    }
    return out;
  }
  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SELLER_SECRET_FIELDS.some((s) => lower.includes(s))) {
        out.secret_fields_detected.push(key);
        out.seller_secrets_detected.push(key);
        out.plaintext_must_not_persist.push(key);
      } else if (PROVIDER_SECRET_FIELDS.some((s) => lower.includes(s))) {
        out.secret_fields_detected.push(key);
        out.provider_secrets_detected.push(key);
      }
      const r = detectSecrets(value, depth + 1);
      mergeDetection(out, r);
    }
  }
  return out;
}

function mergeDetection(target: SecretDetection, src: SecretDetection): void {
  for (const key of ["secret_fields_detected", "seller_secrets_detected", "provider_secrets_detected", "plaintext_must_not_persist"] as const) {
    for (const v of src[key]) {
      if (!target[key].includes(v)) target[key].push(v);
    }
  }
}

/** Decide what to do with a detected provider secret. */
export function providerSecretDecision(options: LegacyImportOptions, providerKey: string): { action: "skip" | "store_ref"; ref?: string } {
  if (options.import_provider_secret === true) {
    return { action: "store_ref", ref: "cred_" + providerKey.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") };
  }
  return { action: "skip" };
}
