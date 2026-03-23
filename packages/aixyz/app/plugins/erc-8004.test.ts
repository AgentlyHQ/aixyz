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
    services: [],
  }),
  getAixyzConfigRuntime: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    skills: [],
    services: [],
  }),
}));

import { AixyzApp } from "../index";
import { BasePlugin } from "../plugin";
import { ERC8004Plugin, getAgentRegistrationFile } from "./erc-8004";

import {
  AgentRegistrationFileSchema,
  ServiceSchema,
  ERC8004_REGISTRATION_TYPE,
} from "@aixyz/erc-8004/schemas/registration";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson(app: AixyzApp, path: string) {
  const res = await app.fetch(new Request(`http://localhost${path}`));
  return { res, json: await res.json() };
}

/** Stub plugin that registers a route, simulating A2A, MCP, or OASF. */
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

async function createApp(
  data: unknown = {},
  opts?: { a2a?: boolean; mcp?: boolean; oasf?: boolean; multiA2A?: boolean },
) {
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
  if (opts?.oasf) {
    await app.withPlugin(new StubPlugin("oasf", [{ method: "GET", path: "/_aixyz/oasf.json" }]));
  }
  await app.withPlugin(new ERC8004Plugin({ default: data }));
  await app.initialize();
  return app;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

describe("ERC8004Plugin", () => {
  test("registers two GET routes returning the registration file as JSON", async () => {
    const app = await createApp({ name: "Test", description: "Test agent" });

    expect(app.routes.has("GET /_aixyz/erc-8004.json")).toBe(true);

    const { res } = await fetchJson(app, "/_aixyz/erc-8004.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  test("route returns valid ERC-8004 JSON", async () => {
    const app = await createApp({ name: "Test", description: "Test agent" });

    const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

    expect(json.type).toBe("https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
  });

  // ---------------------------------------------------------------------------
  // Schema validation — responses must conform to AgentRegistrationFileSchema
  // ---------------------------------------------------------------------------

  describe("schema validation", () => {
    test("response validates against AgentRegistrationFileSchema", async () => {
      const app = await createApp({ name: "My Agent", description: "Does things" }, { mcp: true, a2a: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      const result = AgentRegistrationFileSchema.safeParse(json);
      expect(result.success).toBe(true);
    });

    test("response with config defaults validates against schema", async () => {
      const app = await createApp({}, { mcp: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      const result = AgentRegistrationFileSchema.safeParse(json);
      expect(result.success).toBe(true);
    });

    test("response with MCP only validates against schema", async () => {
      const app = await createApp({}, { mcp: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      const result = AgentRegistrationFileSchema.safeParse(json);
      expect(result.success).toBe(true);
    });

    test("response with A2A only validates against schema", async () => {
      const app = await createApp({}, { a2a: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      const result = AgentRegistrationFileSchema.safeParse(json);
      expect(result.success).toBe(true);
    });

    test("response with multiple A2A endpoints validates against schema", async () => {
      const app = await createApp({}, { mcp: true, multiA2A: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      const result = AgentRegistrationFileSchema.safeParse(json);
      expect(result.success).toBe(true);
      expect(json.services).toHaveLength(3); // 2 A2A + 1 MCP
    });

    test("type field is the ERC-8004 registration literal", async () => {
      const app = await createApp({});

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      expect(json.type).toBe(ERC8004_REGISTRATION_TYPE);
    });

    test("each service validates against ServiceSchema", async () => {
      const app = await createApp({}, { mcp: true, a2a: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      for (const service of json.services) {
        const result = ServiceSchema.safeParse(service);
        expect(result.success).toBe(true);
      }
    });

    test("service endpoints are valid URLs", async () => {
      const app = await createApp({}, { mcp: true, a2a: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      for (const service of json.services) {
        expect(() => new URL(service.endpoint)).not.toThrow();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Response body correctness
  // ---------------------------------------------------------------------------

  describe("response body", () => {
    test("custom registration data is reflected", async () => {
      const app = await createApp({ name: "My Agent", description: "Does things" });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      expect(json.name).toBe("My Agent");
      expect(json.description).toBe("Does things");
      expect(json.active).toBe(true);
      expect(json.x402support).toBe(true);
      expect(json.image).toBe("http://localhost:3000/icon.png");
    });

    test("A2A service has correct fields", async () => {
      const app = await createApp({}, { a2a: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      expect(json.services).toHaveLength(1);
      expect(json.services[0]).toEqual({
        name: "A2A",
        endpoint: "http://localhost:3000/.well-known/agent-card.json",
        version: "0.3.0",
      });
    });

    test("MCP service has correct fields", async () => {
      const app = await createApp({}, { mcp: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      expect(json.services).toHaveLength(1);
      expect(json.services[0]).toEqual({
        name: "MCP",
        endpoint: "http://localhost:3000/mcp",
        version: "2025-06-18",
      });
    });

    test("combined A2A + MCP services in correct order", async () => {
      const app = await createApp({}, { mcp: true, a2a: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      expect(json.services).toHaveLength(2);
      expect(json.services[0].name).toBe("A2A");
      expect(json.services[1].name).toBe("MCP");
    });

    test("config defaults applied for empty registration", async () => {
      const app = await createApp({});

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      expect(json.name).toBe("Test Agent");
      expect(json.description).toBe("A test agent");
      expect(json.active).toBe(true);
      expect(json.x402support).toBe(true);
      expect(json.image).toBe("http://localhost:3000/icon.png");
    });

    test("user-provided fields override config defaults", async () => {
      const app = await createApp({
        name: "Custom Name",
        description: "Custom desc",
        image: "https://example.com/logo.png",
        active: false,
        x402support: false,
      });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      expect(json.name).toBe("Custom Name");
      expect(json.description).toBe("Custom desc");
      expect(json.image).toBe("https://example.com/logo.png");
      expect(json.active).toBe(false);
      expect(json.x402support).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Dynamic service detection via plugins
  // ---------------------------------------------------------------------------

  describe("dynamic service detection", () => {
    test("detects A2A, MCP, and OASF plugins", async () => {
      const app = await createApp({}, { a2a: true, mcp: true, oasf: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      expect(json.services).toHaveLength(3);
      expect(json.services[0].name).toBe("A2A");
      expect(json.services[1].name).toBe("MCP");
      expect(json.services[2].name).toBe("OASF");
    });

    test("no services when no plugins registered", async () => {
      const app = await createApp({});

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      expect(json.services).toHaveLength(0);
    });

    test("OASF service has correct fields", async () => {
      const app = await createApp({}, { oasf: true });

      const { json } = await fetchJson(app, "/_aixyz/erc-8004.json");

      expect(json.services).toHaveLength(1);
      expect(json.services[0]).toMatchObject({
        name: "OASF",
        endpoint: "http://localhost:3000/_aixyz/oasf.json",
        version: "1.0.0",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getAgentRegistrationFile
  // ---------------------------------------------------------------------------

  describe("getAgentRegistrationFile", () => {
    test("returns empty services when mcp: false, a2a: [], oasf: false", () => {
      const file = getAgentRegistrationFile({}, { mcp: false, a2a: [], oasf: false });
      expect(file.services).toEqual([]);
    });

    test("preserves optional registration fields", () => {
      const file = getAgentRegistrationFile(
        {
          name: "Test",
          description: "Test",
          image: "https://example.com/img.png",
          ens: "agent.eth",
          did: "did:example:123",
          supportedTrust: ["reputation"],
        },
        { mcp: true, a2a: [], oasf: false },
      );

      const result = AgentRegistrationFileSchema.safeParse(file);
      expect(result.success).toBe(true);
      expect(file.ens).toBe("agent.eth");
      expect(file.did).toBe("did:example:123");
      expect(file.supportedTrust).toEqual(["reputation"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Unregistered routes
  // ---------------------------------------------------------------------------

  test("POST to well-known returns 404", async () => {
    const app = await createApp({});

    const res = await app.fetch(new Request("http://localhost/_aixyz/erc-8004.json", { method: "POST", body: "{}" }));
    expect(res.status).toBe(404);
  });
});
