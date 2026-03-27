import { describe, expect, test } from "bun:test";
import { InMemorySessionStore } from "./memory";

// ── InMemorySessionStore ─────────────────────────────────────────────

describe("InMemorySessionStore", () => {
  test("get returns undefined for unknown key", async () => {
    const store = new InMemorySessionStore();
    expect(await store.get("0xALICE", "missing")).toBeUndefined();
  });

  test("set then get returns the value", async () => {
    const store = new InMemorySessionStore();
    await store.set("0xALICE", "color", "blue");
    expect(await store.get("0xALICE", "color")).toBe("blue");
  });

  test("delete returns true for existing key, false for missing", async () => {
    const store = new InMemorySessionStore();
    await store.set("0xALICE", "key", "val");
    expect(await store.delete("0xALICE", "key")).toBe(true);
    expect(await store.delete("0xALICE", "key")).toBe(false);
    expect(await store.delete("0xBOB", "key")).toBe(false);
  });

  test("list returns all entries or empty object", async () => {
    const store = new InMemorySessionStore();
    expect(await store.list("0xALICE")).toEqual({ entries: {} });

    await store.set("0xALICE", "a", "1");
    await store.set("0xALICE", "b", "2");
    expect(await store.list("0xALICE")).toEqual({ entries: { a: "1", b: "2" } });
  });

  test("payer isolation — two payers don't see each other's data", async () => {
    const store = new InMemorySessionStore();
    await store.set("0xALICE", "secret", "alice-data");
    await store.set("0xBOB", "secret", "bob-data");

    expect(await store.get("0xALICE", "secret")).toBe("alice-data");
    expect(await store.get("0xBOB", "secret")).toBe("bob-data");
    expect(await store.list("0xALICE")).toEqual({ entries: { secret: "alice-data" } });
  });
});

// ── TTL & LRU ────────────────────────────────────────────────────────

describe("InMemorySessionStore TTL", () => {
  test("expired entry returns undefined on get", async () => {
    const store = new InMemorySessionStore({ ttlMs: 50 });
    await store.set("0xALICE", "key", "val");
    await Bun.sleep(60);
    expect(await store.get("0xALICE", "key")).toBeUndefined();
  });

  test("sliding window: get refreshes TTL", async () => {
    const store = new InMemorySessionStore({ ttlMs: 80 });
    await store.set("0xALICE", "key", "val");
    // Access at ~40ms (within TTL) to refresh
    await Bun.sleep(40);
    expect(await store.get("0xALICE", "key")).toBe("val");
    // Wait another 60ms — 100ms total, but only 60ms since last get
    await Bun.sleep(60);
    expect(await store.get("0xALICE", "key")).toBe("val");
    // Now let it fully expire
    await Bun.sleep(100);
    expect(await store.get("0xALICE", "key")).toBeUndefined();
  });

  test("list filters out expired entries", async () => {
    const store = new InMemorySessionStore({ ttlMs: 50 });
    await store.set("0xALICE", "a", "1");
    await store.set("0xALICE", "b", "2");
    await Bun.sleep(60);
    // Both expired
    expect(await store.list("0xALICE")).toEqual({ entries: {} });
  });

  test("ttlMs: 0 disables expiry", async () => {
    const store = new InMemorySessionStore({ ttlMs: 0 });
    await store.set("0xALICE", "key", "val");
    await Bun.sleep(10);
    expect(await store.get("0xALICE", "key")).toBe("val");
  });
});

describe("InMemorySessionStore LRU eviction", () => {
  test("evicts oldest entry when maxEntries is reached", async () => {
    const store = new InMemorySessionStore({ maxEntries: 3, ttlMs: 0 });
    await store.set("0xALICE", "a", "1");
    await store.set("0xALICE", "b", "2");
    await store.set("0xALICE", "c", "3");
    // This should evict "a"
    await store.set("0xALICE", "d", "4");
    expect(await store.get("0xALICE", "a")).toBeUndefined();
    expect(await store.get("0xALICE", "b")).toBe("2");
    expect(await store.get("0xALICE", "d")).toBe("4");
  });

  test("get promotes entry in LRU order (touched entry survives)", async () => {
    const store = new InMemorySessionStore({ maxEntries: 3, ttlMs: 0 });
    await store.set("0xALICE", "a", "1");
    await store.set("0xALICE", "b", "2");
    await store.set("0xALICE", "c", "3");
    // Touch "a" to promote it
    await store.get("0xALICE", "a");
    // Insert "d" — should evict "b" (now oldest)
    await store.set("0xALICE", "d", "4");
    expect(await store.get("0xALICE", "a")).toBe("1");
    expect(await store.get("0xALICE", "b")).toBeUndefined();
  });

  test("overwrite refreshes LRU position", async () => {
    const store = new InMemorySessionStore({ maxEntries: 3, ttlMs: 0 });
    await store.set("0xALICE", "a", "1");
    await store.set("0xALICE", "b", "2");
    await store.set("0xALICE", "c", "3");
    // Overwrite "a" — moves to most recent
    await store.set("0xALICE", "a", "updated");
    // Insert "d" — should evict "b"
    await store.set("0xALICE", "d", "4");
    expect(await store.get("0xALICE", "a")).toBe("updated");
    expect(await store.get("0xALICE", "b")).toBeUndefined();
  });

  test("eviction works across payers", async () => {
    const store = new InMemorySessionStore({ maxEntries: 2, ttlMs: 0 });
    await store.set("0xALICE", "key", "alice");
    await store.set("0xBOB", "key", "bob");
    // Evicts Alice's entry
    await store.set("0xCHARLIE", "key", "charlie");
    expect(await store.get("0xALICE", "key")).toBeUndefined();
    expect(await store.get("0xBOB", "key")).toBe("bob");
    expect(await store.get("0xCHARLIE", "key")).toBe("charlie");
  });

  test("payer index is cleaned up after all entries evicted", async () => {
    const store = new InMemorySessionStore({ maxEntries: 2, ttlMs: 0 });
    await store.set("0xALICE", "a", "1");
    await store.set("0xALICE", "b", "2");
    // Evict both of Alice's entries
    await store.set("0xBOB", "x", "10");
    await store.set("0xBOB", "y", "20");
    expect(await store.list("0xALICE")).toEqual({ entries: {} });
  });
});

// ── Per-key TTL ──────────────────────────────────────────────────────

describe("InMemorySessionStore per-key TTL", () => {
  test("per-key ttlMs overrides store default", async () => {
    const store = new InMemorySessionStore({ ttlMs: 500 });
    await store.set("0xALICE", "short", "val", { ttlMs: 50 });
    await store.set("0xALICE", "long", "val");
    await Bun.sleep(60);
    expect(await store.get("0xALICE", "short")).toBeUndefined();
    expect(await store.get("0xALICE", "long")).toBe("val");
  });

  test("per-key ttlMs: 0 disables expiry even when store has default", async () => {
    const store = new InMemorySessionStore({ ttlMs: 50 });
    await store.set("0xALICE", "forever", "val", { ttlMs: 0 });
    await Bun.sleep(60);
    expect(await store.get("0xALICE", "forever")).toBe("val");
  });
});

// ── List options ─────────────────────────────────────────────────────

describe("InMemorySessionStore list options", () => {
  test("prefix filters keys", async () => {
    const store = new InMemorySessionStore({ ttlMs: 0 });
    await store.set("0xALICE", "chat:1", "a");
    await store.set("0xALICE", "chat:2", "b");
    await store.set("0xALICE", "pref:theme", "dark");

    const result = await store.list("0xALICE", { prefix: "chat:" });
    expect(result.entries).toEqual({ "chat:1": "a", "chat:2": "b" });
  });

  test("limit and cursor paginate results", async () => {
    const store = new InMemorySessionStore({ ttlMs: 0 });
    await store.set("0xALICE", "a", "1");
    await store.set("0xALICE", "b", "2");
    await store.set("0xALICE", "c", "3");

    const page1 = await store.list("0xALICE", { limit: 2 });
    expect(Object.keys(page1.entries)).toHaveLength(2);
    expect(page1.cursor).toBeDefined();

    const page2 = await store.list("0xALICE", { limit: 2, cursor: page1.cursor });
    expect(Object.keys(page2.entries)).toHaveLength(1);
    expect(page2.cursor).toBeUndefined();
  });

  test("keysOnly returns empty strings for values", async () => {
    const store = new InMemorySessionStore({ ttlMs: 0 });
    await store.set("0xALICE", "key", "secret-value");

    const result = await store.list("0xALICE", { keysOnly: true });
    expect(result.entries).toEqual({ key: "" });
  });
});

// ── Batch operations ─────────────────────────────────────────────────

describe("InMemorySessionStore batch operations", () => {
  test("getMany returns values for existing keys and undefined for missing", async () => {
    const store = new InMemorySessionStore({ ttlMs: 0 });
    await store.set("0xALICE", "a", "1");
    await store.set("0xALICE", "b", "2");

    const result = await store.getMany("0xALICE", ["a", "b", "c"]);
    expect(result).toEqual({ a: "1", b: "2", c: undefined });
  });

  test("setMany sets multiple keys", async () => {
    const store = new InMemorySessionStore({ ttlMs: 0 });
    await store.setMany("0xALICE", { x: "10", y: "20" });

    expect(await store.get("0xALICE", "x")).toBe("10");
    expect(await store.get("0xALICE", "y")).toBe("20");
  });

  test("setMany respects per-key TTL", async () => {
    const store = new InMemorySessionStore({ ttlMs: 500 });
    await store.setMany("0xALICE", { a: "1", b: "2" }, { ttlMs: 50 });
    await Bun.sleep(60);
    expect(await store.get("0xALICE", "a")).toBeUndefined();
    expect(await store.get("0xALICE", "b")).toBeUndefined();
  });

  test("deleteMany returns count of deleted keys", async () => {
    const store = new InMemorySessionStore({ ttlMs: 0 });
    await store.set("0xALICE", "a", "1");
    await store.set("0xALICE", "b", "2");

    const count = await store.deleteMany("0xALICE", ["a", "b", "c"]);
    expect(count).toBe(2);
    expect(await store.get("0xALICE", "a")).toBeUndefined();
  });
});

// ── Constructor validation ───────────────────────────────────────────

describe("InMemorySessionStore constructor validation", () => {
  test("throws when maxEntries < 1", () => {
    expect(() => new InMemorySessionStore({ maxEntries: 0 })).toThrow("maxEntries must be >= 1");
    expect(() => new InMemorySessionStore({ maxEntries: -1 })).toThrow("maxEntries must be >= 1");
  });

  test("throws when ttlMs < 0", () => {
    expect(() => new InMemorySessionStore({ ttlMs: -1 })).toThrow("ttlMs must be >= 0");
  });

  test("accepts valid options", () => {
    expect(() => new InMemorySessionStore({ maxEntries: 1, ttlMs: 0 })).not.toThrow();
  });
});

// ── Close ────────────────────────────────────────────────────────────

describe("InMemorySessionStore close", () => {
  test("close clears all data", async () => {
    const store = new InMemorySessionStore({ ttlMs: 0 });
    await store.set("0xALICE", "key", "val");
    await store.close();
    expect(await store.get("0xALICE", "key")).toBeUndefined();
    expect(await store.list("0xALICE")).toEqual({ entries: {} });
  });
});
