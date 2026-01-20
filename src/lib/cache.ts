type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
  const expiresAt = Date.now() + Math.max(ttlMs, 0);
  store.set(key, { value, expiresAt });
}

export function clearCache(key?: string): void {
  if (typeof key === "string") {
    store.delete(key);
  } else {
    store.clear();
  }
}
