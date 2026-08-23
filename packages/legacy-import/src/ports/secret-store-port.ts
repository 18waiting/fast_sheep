// M11 secret-store port (clean-room). Stores credential_ref only, never plaintext.
export interface SecretStorePort {
  store(providerKey: string, value: string, consent: boolean): { credential_ref: string } | null;
}
