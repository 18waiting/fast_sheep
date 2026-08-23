// M11 secret-store adapter (clean-room). Stores credential_ref only; plaintext
// is never written to canonical stores/reports/logs.
import type { SecretStorePort } from "../ports/secret-store-port.js";

export class SecretStoreAdapter implements SecretStorePort {
  private readonly refs = new Map<string, string>();
  private counter = 0;
  store(providerKey: string, _value: string, consent: boolean): { credential_ref: string } | null {
    if (!consent) return null;
    const ref = "cred_" + providerKey.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") + "_" + (++this.counter);
    this.refs.set(ref, "vaulted"); // plaintext value never retained
    return { credential_ref: ref };
  }
  has(ref: string): boolean { return this.refs.has(ref); }
}
