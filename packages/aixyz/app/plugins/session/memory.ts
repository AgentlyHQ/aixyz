import type { SessionStore, SetOptions, ListOptions, ListResult } from "./index";

// ── Types ─────────────────────────────────────────────────────────────

export interface InMemorySessionStoreOptions {
  /** Maximum number of entries across all payers. Default: 10 000. */
  maxEntries?: number;
  /** Time-to-live in milliseconds (sliding window). 0 = no expiry. Default: 3 600 000 (1 h). */
  ttlMs?: number;
}

interface Entry {
  value: string;
  payer: string;
  key: string;
  expiresAt: number; // 0 = never expires
  ttlMs: number; // effective TTL used when refreshing on get(); 0 = no expiry
}

// ── Implementation ────────────────────────────────────────────────────

/**
 * Production-ready in-memory {@link SessionStore} with LRU eviction and
 * optional TTL.
 *
 * - **LRU eviction** — backed by `Map` insertion-order. When `maxEntries`
 *   is reached, the least-recently-used entry is evicted.
 * - **Sliding-window TTL** — `get()` refreshes the expiry timer.
 *   Expired entries are lazily removed on read; no background timers.
 * - **OOM-safe** — `maxEntries` is a hard cap. Memory usage is bounded
 *   regardless of TTL or access patterns.
 */
export class InMemorySessionStore implements SessionStore {
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  /** Flat LRU map. Key = `${payer}:${key}`. Insertion order = access order. */
  private readonly entries = new Map<string, Entry>();
  /** Secondary index: payer → set of composite keys (for efficient `list`). */
  private readonly payerIndex = new Map<string, Set<string>>();

  constructor(options?: InMemorySessionStoreOptions) {
    this.maxEntries = options?.maxEntries ?? 10_000;
    this.ttlMs = options?.ttlMs ?? 3_600_000;
    if (this.maxEntries < 1) throw new Error("maxEntries must be >= 1");
    if (this.ttlMs < 0) throw new Error("ttlMs must be >= 0");
  }

  async get(payer: string, key: string): Promise<string | undefined> {
    const ck = compositeKey(payer, key);
    const entry = this.entries.get(ck);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.removeEntry(ck, entry);
      return undefined;
    }

    // LRU touch: move to end + refresh TTL using the entry's own TTL
    this.entries.delete(ck);
    entry.expiresAt = this.expiryFor(entry.ttlMs);
    this.entries.set(ck, entry);

    return entry.value;
  }

  async set(payer: string, key: string, value: string, options?: SetOptions): Promise<void> {
    const ck = compositeKey(payer, key);

    // If overwriting, remove first so re-insert lands at the end.
    const existing = this.entries.get(ck);
    if (existing) {
      this.entries.delete(ck);
    }

    // Evict LRU entry if at capacity.
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) {
        const oldestEntry = this.entries.get(oldest.value)!;
        this.removeEntry(oldest.value, oldestEntry);
      }
    }

    const effectiveTtl = options?.ttlMs ?? this.ttlMs;
    const entry: Entry = { value, payer, key, expiresAt: this.expiryFor(effectiveTtl), ttlMs: effectiveTtl };
    this.entries.set(ck, entry);

    // Update payer index.
    let idx = this.payerIndex.get(payer);
    if (!idx) {
      idx = new Set();
      this.payerIndex.set(payer, idx);
    }
    idx.add(ck);
  }

  async delete(payer: string, key: string): Promise<boolean> {
    const ck = compositeKey(payer, key);
    const entry = this.entries.get(ck);
    if (!entry) return false;
    this.removeEntry(ck, entry);
    return true;
  }

  async list(payer: string, options?: ListOptions): Promise<ListResult> {
    const idx = this.payerIndex.get(payer);
    if (!idx) return { entries: {} };

    const prefix = options?.prefix;
    const limit = options?.limit && options.limit > 0 ? options.limit : Infinity;
    const keysOnly = options?.keysOnly ?? false;
    const cursor = options?.cursor;

    const result: Record<string, string> = {};
    let count = 0;
    let pastCursor = !cursor;
    let lastCk: string | undefined;
    let hasMore = false;

    for (const ck of idx) {
      const entry = this.entries.get(ck);
      if (!entry) {
        idx.delete(ck);
        continue;
      }
      if (this.isExpired(entry)) {
        this.removeEntry(ck, entry);
        continue;
      }

      // Skip until we pass the cursor position.
      if (!pastCursor) {
        if (ck === cursor) pastCursor = true;
        continue;
      }

      // Apply prefix filter.
      if (prefix && !entry.key.startsWith(prefix)) continue;

      if (count >= limit) {
        hasMore = true;
        break;
      }

      result[entry.key] = keysOnly ? "" : entry.value;
      lastCk = ck;
      count++;
    }

    if (idx.size === 0) this.payerIndex.delete(payer);
    return { entries: result, cursor: hasMore ? lastCk : undefined };
  }

  async getMany(payer: string, keys: string[]): Promise<Record<string, string | undefined>> {
    const result: Record<string, string | undefined> = {};
    for (const key of keys) {
      result[key] = await this.get(payer, key);
    }
    return result;
  }

  async setMany(payer: string, entries: Record<string, string>, options?: SetOptions): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(payer, key, value, options);
    }
  }

  async deleteMany(payer: string, keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (await this.delete(payer, key)) count++;
    }
    return count;
  }

  async close(): Promise<void> {
    this.entries.clear();
    this.payerIndex.clear();
  }

  // ── Internals ───────────────────────────────────────────────────────

  private removeEntry(ck: string, entry: Entry): void {
    this.entries.delete(ck);
    const idx = this.payerIndex.get(entry.payer);
    if (idx) {
      idx.delete(ck);
      if (idx.size === 0) this.payerIndex.delete(entry.payer);
    }
  }

  private isExpired(entry: Entry): boolean {
    return entry.expiresAt > 0 && Date.now() > entry.expiresAt;
  }

  private expiryFor(ttlMs: number): number {
    return ttlMs > 0 ? Date.now() + ttlMs : 0;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function compositeKey(payer: string, key: string): string {
  return `${payer}:${key}`;
}
