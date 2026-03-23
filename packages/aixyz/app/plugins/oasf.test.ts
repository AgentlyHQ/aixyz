import { afterEach, describe, expect, mock, test } from "bun:test";

const DEFAULT_CONFIG = {
  name: "Test Agent",
  description: "A test agent",
  version: "1.0.0",
  url: "http://localhost:3000",
  x402: { payTo: "0x0000000000000000000000000000000000000000", network: "eip155:8453" },
  build: { tools: [], agents: [], excludes: [], poweredByHeader: true },
  vercel: { maxDuration: 30 },
  skills: [],
  domains: [],
  services: [],
};

const DEFAULT_RUNTIME_CONFIG = {
  name: "Test Agent",
  description: "A test agent",
  version: "1.0.0",
  url: "http://localhost:3000",
  skills: [],
  domains: [],
  services: [],
};

function setMockConfig(overrides?: {
  skills?: unknown[];
  services?: unknown[];
  domains?: Array<{ name: string; id: number }>;
}) {
  mock.module("@aixyz/config", () => ({
    getAixyzConfig: () => ({ ...DEFAULT_CONFIG, ...overrides }),
    getAixyzConfigRuntime: () => ({ ...DEFAULT_RUNTIME_CONFIG, ...overrides }),
  }));
}

setMockConfig();

import { AixyzApp } from "../index";
import { BasePlugin } from "../plugin";
import { OASFPlugin, getOasfRecord } from "./oasf";

afterEach(() => {
  setMockConfig();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson(app: AixyzApp, path: string) {
  const res = await app.fetch(new Request(`http://localhost${path}`));
  return { res, json: await res.json() };
}

/** Stub plugin that registers a route, simulating A2A or MCP. */
class StubPlugin extends BasePlugin {
  readonly name: string;
  constructor(
    name: string,
    private routes: Array<{ method: "GET" | "POST"; path: `/${string}` }>,
  ) {
    super();
    this.name = name;
  }
  register(app: AixyzApp): void {
    for (const r of this.routes) {
      app.route(r.method, r.path, () => Response.json({}));
    }
  }
}

async function createApp(opts?: { a2a?: boolean; mcp?: boolean; multiA2A?: boolean }) {
  const app = new AixyzApp();
  if (opts?.a2a) {
    await app.withPlugin(new StubPlugin("a2a", [{ method: "GET", path: "/.well-known/agent-card.json" }]));
  }
  if (opts?.multiA2A) {
    await app.withPlugin(
      new StubPlugin("a2a-multi", [
        { method: "GET", path: "/.well-known/agent-card.json" },
        { method: "GET", path: "/v2/.well-known/agent-card.json" },
      ]),
    );
  }
  if (opts?.mcp) {
    await app.withPlugin(new StubPlugin("mcp", [{ method: "POST", path: "/mcp" }]));
  }
  await app.withPlugin(new OASFPlugin());
  await app.initialize();
  return app;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

describe("OASFPlugin", () => {
  test("registers GET /_aixyz/oasf.json returning JSON", async () => {
    const app = await createApp();

    expect(app.routes.has("GET /_aixyz/oasf.json")).toBe(true);

    const { res } = await fetchJson(app, "/_aixyz/oasf.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  // ---------------------------------------------------------------------------
  // Required fields always present
  // ---------------------------------------------------------------------------

  describe("required fields", () => {
    test("all required OASF fields present", async () => {
      const app = await createApp();

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      expect(json.name).toBe("Test Agent");
      expect(json.description).toBe("A test agent");
      expect(json.version).toBe("1.0.0");
      expect(json.schema_version).toBe("1.0.0");
      expect(json.authors).toEqual([]);
      expect(typeof json.created_at).toBe("string");
      expect(Number.isNaN(Date.parse(json.created_at))).toBe(false);
      expect(json.domains).toEqual([]);
      expect(json.skills).toEqual([]);
      expect(json.modules).toEqual([]);
    });

    test("config defaults populate name, description, version", async () => {
      const app = await createApp();

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      expect(json.name).toBe("Test Agent");
      expect(json.description).toBe("A test agent");
      expect(json.version).toBe("1.0.0");
    });
  });

  // ---------------------------------------------------------------------------
  // Locators auto-detection
  // ---------------------------------------------------------------------------

  describe("locators", () => {
    test("A2A locator detected from registered agent-card route", async () => {
      const app = await createApp({ a2a: true });

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      expect(json.locators).toEqual([{ type: "a2a", urls: ["http://localhost:3000/.well-known/agent-card.json"] }]);
    });

    test("MCP locator detected from registered mcp plugin", async () => {
      const app = await createApp({ mcp: true });

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      expect(json.locators).toEqual([{ type: "mcp", urls: ["http://localhost:3000/mcp"] }]);
    });

    test("combined A2A + MCP locators in correct order", async () => {
      const app = await createApp({ a2a: true, mcp: true });

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      expect(json.locators).toHaveLength(2);
      expect(json.locators[0].type).toBe("a2a");
      expect(json.locators[1].type).toBe("mcp");
    });

    test("multiple A2A endpoints create single locator with multiple urls", async () => {
      const app = await createApp({ multiA2A: true });

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      expect(json.locators).toHaveLength(1);
      expect(json.locators[0].type).toBe("a2a");
      expect(json.locators[0].urls).toHaveLength(2);
    });

    test("no locators when no A2A or MCP plugins registered", async () => {
      const app = await createApp();

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      expect(json.locators).toEqual([]);
    });

    test("config services mapped to locators", async () => {
      setMockConfig({ services: [{ type: "openapi", url: "https://example.com/openapi.json" }] });

      const app = new AixyzApp();
      const record = getOasfRecord(app);

      expect(record.locators).toEqual([{ type: "openapi", urls: ["https://example.com/openapi.json"] }]);
    });
  });

  // ---------------------------------------------------------------------------
  // getOasfRecord unit tests
  // ---------------------------------------------------------------------------

  describe("getOasfRecord", () => {
    test("returns record with defaults for bare app", () => {
      const app = new AixyzApp();
      const record = getOasfRecord(app);

      expect(record.name).toBe("Test Agent");
      expect(record.description).toBe("A test agent");
      expect(record.version).toBe("1.0.0");
      expect(record.schema_version).toBe("1.0.0");
      expect(record.authors).toEqual([]);
      expect(record.domains).toEqual([]);
      expect(record.skills).toEqual([]);
      expect(record.modules).toEqual([]);
      expect(record.locators).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Skills mapping
  // ---------------------------------------------------------------------------

  describe("skills", () => {
    test("excludes skills without OASF catalog info", () => {
      setMockConfig({
        skills: [
          { id: "trading", name: "Trading", description: "Execute trades", tags: ["finance"] },
          { id: "analysis", name: "Market Analysis", description: "Analyze markets", tags: ["finance"] },
        ],
      });

      const app = new AixyzApp();
      const record = getOasfRecord(app);

      expect(record.skills).toEqual([]);
    });

    test("maps skills with OASF catalog info", () => {
      setMockConfig({
        skills: [
          {
            id: "trading",
            name: "Trading",
            description: "Execute trades",
            tags: ["finance"],
            oasf: { name: "finance_and_business/trading", id: 201 },
          },
          { id: "analysis", name: "Market Analysis", description: "Analyze markets", tags: ["finance"] },
        ],
      });

      const app = new AixyzApp();
      const record = getOasfRecord(app);

      expect(record.skills).toEqual([{ name: "finance_and_business/trading", id: 201 }]);
    });
  });

  // ---------------------------------------------------------------------------
  // Domains mapping
  // ---------------------------------------------------------------------------

  describe("domains", () => {
    test("maps config domains to OASF domains", () => {
      setMockConfig({
        domains: [
          { name: "finance_and_business", id: 2 },
          { name: "technology/blockchain", id: 109 },
        ],
      });

      const app = new AixyzApp();
      const record = getOasfRecord(app);

      expect(record.domains).toEqual([
        { name: "finance_and_business", id: 2 },
        { name: "technology/blockchain", id: 109 },
      ]);
    });

    test("defaults to empty array when no domains configured", () => {
      const app = new AixyzApp();
      const record = getOasfRecord(app);

      expect(record.domains).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Modules auto-detection
  // ---------------------------------------------------------------------------

  describe("modules", () => {
    test("A2A plugin registered → modules includes integration/a2a with card data", async () => {
      const app = await createApp({ a2a: true });

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      const a2aModule = json.modules.find((m: any) => m.name === "integration/a2a");
      expect(a2aModule).toBeDefined();
      expect(a2aModule.id).toBe(203);
      expect(a2aModule.data.card_schema_version).toBe("0.3.0");
      expect(a2aModule.data.card_data).toBeDefined();
      expect(a2aModule.data.card_data.name).toBe("Test Agent");
      expect(a2aModule.data.card_data.protocolVersion).toBe("0.3.0");
    });

    test("MCP plugin registered → modules includes integration/mcp with connection", async () => {
      const app = await createApp({ mcp: true });

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      const mcpModule = json.modules.find((m: any) => m.name === "integration/mcp");
      expect(mcpModule).toBeDefined();
      expect(mcpModule.id).toBe(202);
      expect(mcpModule.data.name).toBe("Test Agent");
      expect(mcpModule.data.connections).toEqual([{ type: "streamable-http", url: "http://localhost:3000/mcp" }]);
    });

    test("both plugins → both modules present", async () => {
      const app = await createApp({ a2a: true, mcp: true });

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      expect(json.modules).toHaveLength(2);
      expect(json.modules.find((m: any) => m.name === "integration/a2a")).toBeDefined();
      expect(json.modules.find((m: any) => m.name === "integration/mcp")).toBeDefined();
    });

    test("no plugins → modules is empty", async () => {
      const app = await createApp();

      const { json } = await fetchJson(app, "/_aixyz/oasf.json");

      expect(json.modules).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Unregistered routes
  // ---------------------------------------------------------------------------

  test("POST to well-known returns 404", async () => {
    const app = await createApp();

    const res = await app.fetch(new Request("http://localhost/_aixyz/oasf.json", { method: "POST", body: "{}" }));
    expect(res.status).toBe(404);
  });
});
