export class MemoryCache {
  constructor(defaultTtlMs = 45000) {
    this.defaultTtlMs = defaultTtlMs;
    this.cache = new Map();
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }
  set(key, value, ttlMs = this.defaultTtlMs) {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
  invalidate(key) {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }
}
export const globalCache = new MemoryCache(45000);
