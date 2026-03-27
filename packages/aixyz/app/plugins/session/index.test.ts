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

import { AixyzApp } from "../../index";
import { SessionPlugin, InMemorySessionStore, getSession, getPayer, type SessionStore } from "./index";

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
    expect(json.all).toEqual({ entries: { color: "blue", food: "pizza" } });
    expect(json.deleted).toBe(true);
    expect(json.afterDelete).toEqual({ entries: { color: "blue" } });
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

  test("unpaid internal fetch from a paid handler does not inherit the outer session (ALS isolation)", async () => {
    // Regression test for AsyncLocalStorage context leaking: when a paid
    // handler calls app.fetch() on an unpaid route in the same async chain,
    // getSession() inside the unpaid route must be undefined — not the
    // outer payer's session.
    const app = new AixyzApp();
    const plugin = new SessionPlugin();
    await app.withPlugin(plugin);

    // Mock payment: returns "0xALICE" for requests with an X-Payer header,
    // undefined otherwise (simulates paid vs free routes on the same server).
    plugin.initialize({
      routes: app.routes,
      getPlugin: () => undefined,
      payment: {
        getPayer: (req: Request) => req.headers.get("x-payer") ?? undefined,
      } as any,
    });

    let innerSession: ReturnType<typeof getSession>;
    let innerPayer: ReturnType<typeof getPayer>;

    // Unpaid internal route — should never see a session.
    app.route("GET", "/internal/free", async () => {
      innerSession = getSession();
      innerPayer = getPayer();
      return Response.json({ hasSession: innerSession !== undefined });
    });

    // Paid route that internally fetches the unpaid route.
    app.route("GET", "/paid", async () => {
      const outerSession = getSession();
      // Sanity check: the paid route itself has a session.
      if (!outerSession) throw new Error("expected session in paid route");

      // Internal fetch to an unpaid route — no X-Payer header.
      const innerRes = await app.fetch(new Request("http://localhost/internal/free"));
      const innerJson = await innerRes.json();
      return Response.json({ outerPayer: outerSession.payer, innerHasSession: innerJson.hasSession });
    });

    const res = await app.fetch(new Request("http://localhost/paid", { headers: { "x-payer": "0xALICE" } }));
    const json = await res.json();

    expect(json.outerPayer).toBe("0xALICE");
    // This is the critical assertion: the inner unpaid route must NOT
    // inherit the outer paid session via AsyncLocalStorage.
    expect(json.innerHasSession).toBe(false);
    expect(innerSession!).toBeUndefined();
    expect(innerPayer!).toBeUndefined();
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
        return { entries: {} };
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

// ── runWithPayer ─────────────────────────────────────────────────────

describe("SessionPlugin.runWithPayer", () => {
  test("getSession returns a session scoped to the given payer", async () => {
    const plugin = new SessionPlugin();

    let captured: ReturnType<typeof getSession>;
    plugin.runWithPayer("0xALICE", () => {
      captured = getSession();
    });

    expect(captured!).toBeDefined();
    expect(captured!.payer).toBe("0xALICE");
  });

  test("normalizes payer address for storage (checksummed → lowercase)", async () => {
    const store = new InMemorySessionStore();
    const plugin = new SessionPlugin({ store });

    await plugin.runWithPayer("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12", async () => {
      await getSession()!.set("key", "value");
    });

    // Store should have the entry under the lowercase payer
    expect(await store.get("0xabcdef1234567890abcdef1234567890abcdef12", "key")).toBe("value");
  });

  test("does not leak session context after returning", () => {
    const plugin = new SessionPlugin();

    plugin.runWithPayer("0xALICE", () => {
      expect(getSession()).toBeDefined();
    });

    // Outside runWithPayer, getSession should return undefined
    expect(getSession()).toBeUndefined();
  });
});
