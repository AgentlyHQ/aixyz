import { describe, expect, mock, test } from "bun:test";

mock.module("@aixyz/config", () => ({
  getAixyzConfig: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    x402: { payTo: "0x0000000000000000000000000000000000000000", network: "eip155:8453" },
    build: { tools: [], agents: [], excludes: [], poweredByHeader: true },
    vercel: { maxDuration: 30 },
    skills: [],
  }),
  getAixyzConfigRuntime: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    skills: [],
  }),
}));

import { AixyzApp } from "../index";
import { SessionPlugin, InMemorySessionStore, getSession, getPayer, type SessionStore } from "./session";

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
    expect(await store.list("0xALICE")).toEqual({});

    await store.set("0xALICE", "a", "1");
    await store.set("0xALICE", "b", "2");
    expect(await store.list("0xALICE")).toEqual({ a: "1", b: "2" });
  });

  test("payer isolation — two payers don't see each other's data", async () => {
    const store = new InMemorySessionStore();
    await store.set("0xALICE", "secret", "alice-data");
    await store.set("0xBOB", "secret", "bob-data");

    expect(await store.get("0xALICE", "secret")).toBe("alice-data");
    expect(await store.get("0xBOB", "secret")).toBe("bob-data");
    expect(await store.list("0xALICE")).toEqual({ secret: "alice-data" });
  });
});

// ── SessionPlugin ────────────────────────────────────────────────────

/**
 * Helper: create an AixyzApp with SessionPlugin and a mock payment gateway
 * that returns the given payer address for every request.
 */
async function createAppWithSession(payer: string | undefined, store?: SessionStore) {
  const app = new AixyzApp();
  const plugin = new SessionPlugin(store ? { store } : undefined);
  await app.withPlugin(plugin);

  // Inject a mock payment gateway via initialize.
  // The middleware reads this.payment?.getPayer(request) at request time.
  const mockPayment = payer ? { getPayer: () => payer } : undefined;
  plugin.initialize({
    routes: app.routes,
    getPlugin: () => undefined,
    payment: mockPayment as any,
  });

  return { app, plugin };
}

describe("SessionPlugin", () => {
  test("plugin name is 'session'", () => {
    const plugin = new SessionPlugin();
    expect(plugin.name).toBe("session");
  });

  test("does not register any routes (middleware only)", async () => {
    const { plugin } = await createAppWithSession(undefined);
    expect(plugin.registeredRoutes.size).toBe(0);
  });

  test("getSession returns Session with correct payer when payment is present", async () => {
    const { app } = await createAppWithSession("0xALICE");

    let captured: ReturnType<typeof getSession>;
    app.route("GET", "/test", async () => {
      captured = getSession();
      return Response.json({ payer: captured?.payer });
    });

    const res = await app.fetch(new Request("http://localhost/test"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.payer).toBe("0xALICE");
    expect(captured!).toBeDefined();
    expect(captured!.payer).toBe("0xALICE");
  });

  test("session.get/set/list/delete work within middleware context", async () => {
    const { app } = await createAppWithSession("0xALICE");

    app.route("GET", "/test", async () => {
      const session = getSession()!;
      await session.set("color", "blue");
      await session.set("food", "pizza");
      const color = await session.get("color");
      const all = await session.list();
      const deleted = await session.delete("food");
      const afterDelete = await session.list();
      return Response.json({ color, all, deleted, afterDelete });
    });

    const res = await app.fetch(new Request("http://localhost/test"));
    const json = await res.json();

    expect(json.color).toBe("blue");
    expect(json.all).toEqual({ color: "blue", food: "pizza" });
    expect(json.deleted).toBe(true);
    expect(json.afterDelete).toEqual({ color: "blue" });
  });

  test("getSession returns undefined when no payer (free route)", async () => {
    const { app } = await createAppWithSession(undefined);

    let captured: ReturnType<typeof getSession>;
    app.route("GET", "/test", async () => {
      captured = getSession();
      return Response.json({ hasSession: captured !== undefined });
    });

    const res = await app.fetch(new Request("http://localhost/test"));
    const json = await res.json();

    expect(json.hasSession).toBe(false);
    expect(captured!).toBeUndefined();
  });

  test("getPayer returns the payer address", async () => {
    const { app } = await createAppWithSession("0xALICE");

    app.route("GET", "/test", async () => {
      return Response.json({ payer: getPayer() });
    });

    const res = await app.fetch(new Request("http://localhost/test"));
    const json = await res.json();
    expect(json.payer).toBe("0xALICE");
  });

  test("custom store is used by middleware", async () => {
    const calls: string[] = [];
    const customStore: SessionStore = {
      get: async (payer, key) => {
        calls.push(`get:${payer}:${key}`);
        return "custom-value";
      },
      set: async (payer, key, value) => {
        calls.push(`set:${payer}:${key}:${value}`);
      },
      delete: async (payer, key) => {
        calls.push(`delete:${payer}:${key}`);
        return true;
      },
      list: async (payer) => {
        calls.push(`list:${payer}`);
        return {};
      },
    };

    const { app } = await createAppWithSession("0xALICE", customStore);

    app.route("GET", "/test", async () => {
      const session = getSession()!;
      await session.set("k", "v");
      await session.get("k");
      await session.delete("k");
      await session.list();
      return Response.json({ ok: true });
    });

    await app.fetch(new Request("http://localhost/test"));

    expect(calls).toEqual(["set:0xalice:k:v", "get:0xalice:k", "delete:0xalice:k", "list:0xalice"]);
  });

  test("session data persists across requests for same payer", async () => {
    const { app } = await createAppWithSession("0xALICE");

    app.route("POST", "/write", async () => {
      await getSession()!.set("key", "persisted");
      return Response.json({ ok: true });
    });
    app.route("GET", "/read", async () => {
      const val = await getSession()!.get("key");
      return Response.json({ val });
    });

    await app.fetch(new Request("http://localhost/write", { method: "POST" }));
    const res = await app.fetch(new Request("http://localhost/read"));
    const json = await res.json();

    expect(json.val).toBe("persisted");
  });

  test("uses InMemorySessionStore by default", () => {
    const plugin = new SessionPlugin();
    expect(plugin.store).toBeInstanceOf(InMemorySessionStore);
  });

  test("checksummed and lowercase payer address share the same session (normalization)", async () => {
    // The checksummed address and its lowercase variant must share the same store slot.
    const checksummedPayer = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    const lowercasePayer = checksummedPayer.toLowerCase();
    const store = new InMemorySessionStore();

    // Write via a checksummed payer address
    const { app: appWrite } = await createAppWithSession(checksummedPayer, store);
    appWrite.route("POST", "/write", async () => {
      await getSession()!.set("shared", "hello");
      return Response.json({ ok: true });
    });
    await appWrite.fetch(new Request("http://localhost/write", { method: "POST" }));

    // The store must have been written under the lowercase key
    expect(await store.get(lowercasePayer, "shared")).toBe("hello");

    // Read back via a lowercase payer address — same slot, same data
    const { app: appRead } = await createAppWithSession(lowercasePayer, store);
    appRead.route("GET", "/read", async () => {
      const val = await getSession()!.get("shared");
      return Response.json({ val });
    });
    const res = await appRead.fetch(new Request("http://localhost/read"));
    const json = await res.json();
    expect(json.val).toBe("hello");
  });
});
