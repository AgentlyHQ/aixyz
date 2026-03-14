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

import { AixyzApp } from "aixyz/app";
import { toNextRouteHandler } from "./index";

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

  test("all method handlers share the same underlying fetch", async () => {
    const app = new AixyzApp();
    app.route("GET", "/ping", () => new Response("pong"));
    app.route("POST", "/ping", () => new Response("pong-post"));

    const handlers = toNextRouteHandler(app);

    const getRes = await handlers.GET(new Request("http://localhost/ping", { method: "GET" }));
    expect(getRes.status).toBe(200);
    expect(await getRes.text()).toBe("pong");

    const postRes = await handlers.POST(new Request("http://localhost/ping", { method: "POST" }));
    expect(postRes.status).toBe(200);
    expect(await postRes.text()).toBe("pong-post");
  });

  test("PUT handler dispatches correctly", async () => {
    const app = new AixyzApp();
    app.route("PUT", "/item", () => new Response("updated"));

    const { PUT } = toNextRouteHandler(app);
    const res = await PUT(new Request("http://localhost/item", { method: "PUT" }));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("updated");
  });

  test("DELETE handler dispatches correctly", async () => {
    const app = new AixyzApp();
    app.route("DELETE", "/item", () => new Response("deleted"));

    const { DELETE } = toNextRouteHandler(app);
    const res = await DELETE(new Request("http://localhost/item", { method: "DELETE" }));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("deleted");
  });

  test("middleware applied to all handlers", async () => {
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

  test("handlers can be destructured and used as named exports", async () => {
    const app = new AixyzApp();
    app.route("GET", "/", () => Response.json({ status: "ok" }));

    // Simulates: export const { GET, POST } = toNextRouteHandler(app);
    const { GET, POST } = toNextRouteHandler(app);

    const res = await GET(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: "ok" });

    // POST not registered → 404
    const notFound = await POST(new Request("http://localhost/", { method: "POST" }));
    expect(notFound.status).toBe(404);
  });
});
