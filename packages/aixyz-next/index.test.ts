import { describe, expect, mock, test } from "bun:test";

mock.module("@aixyz/config", () => ({
  getAixyzConfig: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    x402: { payTo: "0x0000000000000000000000000000000000000000", network: "eip155:8453" },
    build: { tools: [], agents: [], excludes: [] },
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

mock.module("aixyz/accepts", () => ({
  // null facilitator: disables x402 in unit tests so we can focus on plugin wiring
  facilitator: null,
  AcceptsScheme: {
    parse: (v: unknown) => v,
  },
  HTTPFacilitatorClient: class {},
}));

import { tool } from "ai";
import { z } from "zod";
import { AixyzApp } from "aixyz/app";
import { createNextHandler, toNextRouteHandler } from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockAgent(text = "Hello world") {
  return {
    stream: async () => ({
      textStream: (async function* () {
        yield text;
      })(),
    }),
  } as any;
}

function makeMockTool(result = "tool result") {
  return tool({
    description: "A mock tool",
    parameters: z.object({ input: z.string() }),
    execute: async () => result,
  });
}

// ---------------------------------------------------------------------------
// createNextHandler — the high-level "magical" API
// ---------------------------------------------------------------------------

describe("createNextHandler", () => {
  test("returns handlers for all standard HTTP methods", () => {
    const handlers = createNextHandler();
    expect(typeof handlers.GET).toBe("function");
    expect(typeof handlers.POST).toBe("function");
    expect(typeof handlers.PUT).toBe("function");
    expect(typeof handlers.DELETE).toBe("function");
    expect(typeof handlers.PATCH).toBe("function");
    expect(typeof handlers.HEAD).toBe("function");
    expect(typeof handlers.OPTIONS).toBe("function");
  });

  test("returns 404 for unregistered path with no plugins", async () => {
    const { GET } = createNextHandler();
    const res = await GET(new Request("http://localhost/missing"));
    expect(res.status).toBe(404);
  });

  test("auto-registers A2A well-known and agent routes when agent provided", async () => {
    const { GET, POST } = createNextHandler({
      agent: { default: makeMockAgent(), accepts: { scheme: "free" } },
    });

    const card = await GET(new Request("http://localhost/.well-known/agent-card.json"));
    expect(card.status).toBe(200);
    const json = await card.json();
    expect(json.name).toBe("Test Agent");

    // POST /agent responds (returns a JSON-RPC result)
    const agentRes = await POST(
      new Request("http://localhost/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "message/send",
          params: {
            message: {
              kind: "message",
              messageId: "msg-1",
              role: "user",
              parts: [{ kind: "text", text: "hi" }],
            },
          },
        }),
      }),
    );
    expect(agentRes.status).toBe(200);
  });

  test("auto-registers IndexPage route at /", async () => {
    const { GET } = createNextHandler({
      agent: { default: makeMockAgent(), accepts: { scheme: "free" } },
    });

    const res = await GET(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Test Agent");
  });

  test("auto-registers MCP routes when tools provided", async () => {
    const { POST } = createNextHandler({
      tools: [{ name: "mock", exports: { default: makeMockTool() } }],
    });

    const res = await POST(new Request("http://localhost/mcp", { method: "POST" }));
    // MCP endpoint exists (not 404)
    expect(res.status).not.toBe(404);
  });

  test("lazy-initializes — app is built once across concurrent requests", async () => {
    const { GET } = createNextHandler({
      agent: { default: makeMockAgent(), accepts: { scheme: "free" } },
    });

    // Fire concurrent requests; if app were re-initialized each time it would
    // rebuild the route table and the second request might race incorrectly.
    const [r1, r2] = await Promise.all([
      GET(new Request("http://localhost/.well-known/agent-card.json")),
      GET(new Request("http://localhost/.well-known/agent-card.json")),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  test("handlers can be destructured as named exports", async () => {
    const { GET, POST } = createNextHandler({
      agent: { default: makeMockAgent(), accepts: { scheme: "free" } },
    });

    const card = await GET(new Request("http://localhost/.well-known/agent-card.json"));
    expect(card.status).toBe(200);

    // GET /agent should 404 (only POST registered by A2APlugin)
    const notFound = await GET(new Request("http://localhost/agent"));
    expect(notFound.status).toBe(404);
    void POST;
  });
});

// ---------------------------------------------------------------------------
// toNextRouteHandler — the low-level escape-hatch
// ---------------------------------------------------------------------------

describe("toNextRouteHandler", () => {
  test("returns handlers for all standard HTTP methods", () => {
    const app = new AixyzApp();
    const handlers = toNextRouteHandler(app);

    expect(typeof handlers.GET).toBe("function");
    expect(typeof handlers.POST).toBe("function");
    expect(typeof handlers.PUT).toBe("function");
    expect(typeof handlers.DELETE).toBe("function");
    expect(typeof handlers.PATCH).toBe("function");
    expect(typeof handlers.HEAD).toBe("function");
    expect(typeof handlers.OPTIONS).toBe("function");
  });

  test("GET handler dispatches to app.fetch and returns response", async () => {
    const app = new AixyzApp();
    app.route("GET", "/hello", () => new Response("world", { status: 200 }));

    const { GET } = toNextRouteHandler(app);
    const res = await GET(new Request("http://localhost/hello"));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("world");
  });

  test("POST handler dispatches to app.fetch and returns response", async () => {
    const app = new AixyzApp();
    app.route("POST", "/submit", () => new Response("ok", { status: 201 }));

    const { POST } = toNextRouteHandler(app);
    const res = await POST(new Request("http://localhost/submit", { method: "POST" }));

    expect(res.status).toBe(201);
    expect(await res.text()).toBe("ok");
  });

  test("returns 404 for unregistered routes", async () => {
    const app = new AixyzApp();
    const { GET } = toNextRouteHandler(app);

    const res = await GET(new Request("http://localhost/missing"));
    expect(res.status).toBe(404);
  });

  test("PUT, DELETE handlers dispatch correctly", async () => {
    const app = new AixyzApp();
    app.route("PUT", "/item", () => new Response("updated"));
    app.route("DELETE", "/item", () => new Response("deleted"));

    const { PUT, DELETE } = toNextRouteHandler(app);

    const putRes = await PUT(new Request("http://localhost/item", { method: "PUT" }));
    expect(putRes.status).toBe(200);
    expect(await putRes.text()).toBe("updated");

    const delRes = await DELETE(new Request("http://localhost/item", { method: "DELETE" }));
    expect(delRes.status).toBe(200);
    expect(await delRes.text()).toBe("deleted");
  });

  test("middleware runs through all handlers", async () => {
    const app = new AixyzApp();
    app.use(async (_req, next) => {
      const res = await next();
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...Object.fromEntries(res.headers), "x-next-adapter": "true" },
      });
    });
    app.route("GET", "/mw", () => new Response("ok"));

    const { GET } = toNextRouteHandler(app);
    const res = await GET(new Request("http://localhost/mw"));

    expect(res.headers.get("x-next-adapter")).toBe("true");
    expect(await res.text()).toBe("ok");
  });
});
