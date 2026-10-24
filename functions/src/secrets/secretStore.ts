/**
 * Provider credentials are stored in Google Secret Manager — never in
 * Firestore, client storage or source. Firestore keeps only a reference and a
 * masked suffix. A dev-only store backs the local emulator.
 */
export interface SecretStore {
  /** Stores a new version and returns an opaque reference (no secret material). */
  put(providerId: string, value: string): Promise<{ ref: string }>;
  get(providerId: string): Promise<string | undefined>;
  /** Disables all versions (e.g. a compromised key). */
  disable(providerId: string): Promise<void>;
  remove(providerId: string): Promise<void>;
}

const CACHE_TTL_MS = 5 * 60_000;

export class CachedSecretStore implements SecretStore {
  private cache = new Map<string, { value: string | undefined; at: number }>();
  constructor(private inner: SecretStore, private ttlMs = CACHE_TTL_MS) {}
  async put(id: string, value: string) {
    this.cache.delete(id);
    return this.inner.put(id, value);
  }
  async get(id: string) {
    const hit = this.cache.get(id);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
    const value = await this.inner.get(id);
    this.cache.set(id, { value, at: Date.now() });
    return value;
  }
  async disable(id: string) {
    this.cache.delete(id);
    return this.inner.disable(id);
  }
  async remove(id: string) {
    this.cache.delete(id);
    return this.inner.remove(id);
  }
}

/** In-memory store for unit tests only. */
export class MemorySecretStore implements SecretStore {
  values = new Map<string, { value: string; enabled: boolean }>();
  async put(id: string, value: string) {
    this.values.set(id, { value, enabled: true });
    return { ref: `memory://${id}` };
  }
  async get(id: string) {
    const v = this.values.get(id);
    return v?.enabled ? v.value : undefined;
  }
  async disable(id: string) {
    const v = this.values.get(id);
    if (v) v.enabled = false;
  }
  async remove(id: string) {
    this.values.delete(id);
  }
}
