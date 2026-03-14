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

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { tool } from "ai";
import { z } from "zod";
import { AixyzApp } from "aixyz/app";
import { createNextHandler, ensureRouteFile, generateAixyzRoute, toNextRouteHandler, withAixyzConfig } from "./index";

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

/** Create a temp project directory for filesystem tests. */
function makeTempProject(): string {
  const dir = join(tmpdir(), `aixyz-next-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, ".next", "cache", "aixyz"), { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// withAixyzConfig — Next.js config wrapper
// ---------------------------------------------------------------------------

describe("withAixyzConfig", () => {
  test("returns a config object with a webpack function", () => {
    const config = withAixyzConfig({});
    expect(typeof config).toBe("object");
    expect(typeof config.webpack).toBe("function");
  });

  test("webpack function creates route file and adds @aixyz/next/route alias", () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "app"), { recursive: true });

    const config = withAixyzConfig({});
    const webpackConfig: any = { resolve: { alias: {} } };
    const result = (config.webpack as any)(webpackConfig, { isServer: true, dir });

    // Alias points to a generated .mjs file
    expect(typeof result.resolve.alias["@aixyz/next/route"]).toBe("string");
    expect(result.resolve.alias["@aixyz/next/route"]).toContain("route.mjs");

    // Route file was auto-created
    const routeFile = join(dir, "app", "api", "[[...route]]", "route.ts");
    expect(existsSync(routeFile)).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  test("webpack function calls through user-provided webpack", () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "app"), { recursive: true });

    let called = false;
    const userWebpack = (cfg: any) => {
      called = true;
      return cfg;
    };
    const config = withAixyzConfig({ webpack: userWebpack });
    const webpackConfig: any = { resolve: { alias: {} } };
    (config.webpack as any)(webpackConfig, { isServer: true, dir });

    expect(called).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  test("preserves user config keys", () => {
    const config = withAixyzConfig({ reactStrictMode: true, swcMinify: true } as any);
    expect((config as any).reactStrictMode).toBe(true);
    expect((config as any).swcMinify).toBe(true);
  });

  test("webpack function does not create duplicate aliases when called twice", () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "app"), { recursive: true });

    const config = withAixyzConfig({});
    const webpackConfig: any = { resolve: { alias: {} } };

    // Simulate webpack calling the function twice (server + client compile)
    (config.webpack as any)(webpackConfig, { isServer: true, dir });
    const result = (config.webpack as any)(webpackConfig, { isServer: false, dir });

    expect(typeof result.resolve.alias["@aixyz/next/route"]).toBe("string");
    rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// ensureRouteFile — auto-creates app/api/[[...route]]/route.ts
// ---------------------------------------------------------------------------

describe("ensureRouteFile", () => {
  test("creates route file when it does not exist", () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "app"), { recursive: true });

    ensureRouteFile(dir);

    const routeFile = join(dir, "app", "api", "[[...route]]", "route.ts");
    expect(existsSync(routeFile)).toBe(true);
    const content = readFileSync(routeFile, "utf-8");
    expect(content).toContain("@aixyz/next/route");
    expect(content).toContain("GET");

    rmSync(dir, { recursive: true, force: true });
  });

  test("does not overwrite an existing route file", () => {
    const dir = makeTempProject();
    const routeDir = join(dir, "app", "api", "[[...route]]");
    mkdirSync(routeDir, { recursive: true });
    const routeFile = join(routeDir, "route.ts");
    writeFileSync(routeFile, "// custom\n");

    ensureRouteFile(dir);

    expect(readFileSync(routeFile, "utf-8")).toBe("// custom\n");
    rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// generateAixyzRoute — scans app/ and emits .next/cache/aixyz/route.mjs
// ---------------------------------------------------------------------------

describe("generateAixyzRoute", () => {
  test("generates minimal handler when app/ has no agent or tools", () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "app"), { recursive: true });

    const routePath = generateAixyzRoute(dir);

    expect(existsSync(routePath)).toBe(true);
    const code = readFileSync(routePath, "utf-8");
    expect(code).toContain(`import { createNextHandler } from "@aixyz/next"`);
    expect(code).toContain("GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS");
    expect(code).not.toContain("__agent");
    expect(code).not.toContain("__tool_");

    rmSync(dir, { recursive: true, force: true });
  });

  test("includes agent import when app/agent.ts exists", () => {
    const dir = makeTempProject();
    const appDir = join(dir, "app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "agent.ts"), "export default {}; export const accepts = { scheme: 'free' };");

    const routePath = generateAixyzRoute(dir);
    const code = readFileSync(routePath, "utf-8");

    expect(code).toContain("import * as __agent");
    expect(code).toContain("agent.ts");
    expect(code).toContain("agent: __agent");

    rmSync(dir, { recursive: true, force: true });
  });

  test("includes agent import when app/agent.js exists", () => {
    const dir = makeTempProject();
    const appDir = join(dir, "app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "agent.js"), "exports.default = {};");

    const routePath = generateAixyzRoute(dir);
    const code = readFileSync(routePath, "utf-8");

    expect(code).toContain("agent.js");
    expect(code).toContain("agent: __agent");

    rmSync(dir, { recursive: true, force: true });
  });

  test("includes tool imports when app/tools/*.ts exist", () => {
    const dir = makeTempProject();
    const toolsDir = join(dir, "app", "tools");
    mkdirSync(toolsDir, { recursive: true });
    writeFileSync(join(toolsDir, "weather.ts"), "export default {};");
    writeFileSync(join(toolsDir, "search.ts"), "export default {};");

    const routePath = generateAixyzRoute(dir);
    const code = readFileSync(routePath, "utf-8");

    expect(code).toContain("__tool_weather");
    expect(code).toContain("__tool_search");
    expect(code).toContain(`name: "weather"`);
    expect(code).toContain(`name: "search"`);

    rmSync(dir, { recursive: true, force: true });
  });

  test("skips tool files starting with underscore", () => {
    const dir = makeTempProject();
    const toolsDir = join(dir, "app", "tools");
    mkdirSync(toolsDir, { recursive: true });
    writeFileSync(join(toolsDir, "weather.ts"), "export default {};");
    writeFileSync(join(toolsDir, "_private.ts"), "export default {};");
    writeFileSync(join(toolsDir, "_helper.ts"), "export default {};");

    const routePath = generateAixyzRoute(dir);
    const code = readFileSync(routePath, "utf-8");

    expect(code).toContain("__tool_weather");
    expect(code).not.toContain("_private");
    expect(code).not.toContain("_helper");

    rmSync(dir, { recursive: true, force: true });
  });

  test("generated code uses correct tool names for kebab-case files", () => {
    const dir = makeTempProject();
    const toolsDir = join(dir, "app", "tools");
    mkdirSync(toolsDir, { recursive: true });
    writeFileSync(join(toolsDir, "get-weather.ts"), "export default {};");

    const routePath = generateAixyzRoute(dir);
    const code = readFileSync(routePath, "utf-8");

    // Identifier uses underscores; name stays kebab-case
    expect(code).toContain("__tool_get_weather");
    expect(code).toContain(`name: "get-weather"`);

    rmSync(dir, { recursive: true, force: true });
  });

  test("generated file is written to .next/cache/aixyz/route.mjs", () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "app"), { recursive: true });

    const routePath = generateAixyzRoute(dir);

    expect(routePath).toContain(join(".next", "cache", "aixyz", "route.mjs"));
    expect(existsSync(routePath)).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });
});

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
