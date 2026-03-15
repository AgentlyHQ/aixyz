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

function createApp(data: unknown = {}, options = { mcp: true, a2a: ["/.well-known/agent-card.json"] }) {
  const app = new AixyzApp();
  app.withPlugin(new ERC8004Plugin({ default: data, options }));
  return app;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

describe("ERC8004Plugin", () => {
  test("registers two GET routes returning the registration file as JSON", async () => {
    const app = createApp({ name: "Test", description: "Test agent" });

    expect(app.routes.has("GET /.well-known/erc-8004.json")).toBe(true);
    expect(app.routes.has("GET /_aixyz/erc-8004.json")).toBe(true);

    const { res } = await fetchJson(app, "/.well-known/erc-8004.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  test("both routes return identical JSON", async () => {
    const app = createApp({ name: "Test", description: "Test agent" });

    const { json: json1 } = await fetchJson(app, "/.well-known/erc-8004.json");
    const { json: json2 } = await fetchJson(app, "/_aixyz/erc-8004.json");

    expect(json1).toEqual(json2);
  });

  // ---------------------------------------------------------------------------
  // Schema validation — responses must conform to AgentRegistrationFileSchema
  // ---------------------------------------------------------------------------

  describe("schema validation", () => {
    test("response validates against AgentRegistrationFileSchema", async () => {
      const app = createApp({ name: "My Agent", description: "Does things" });

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      const result = AgentRegistrationFileSchema.safeParse(json);
      expect(result.success).toBe(true);
    });

    test("response with config defaults validates against schema", async () => {
      const app = createApp({});

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      const result = AgentRegistrationFileSchema.safeParse(json);
      expect(result.success).toBe(true);
    });

    test("response with MCP only validates against schema", async () => {
      const app = createApp({}, { mcp: true, a2a: [] });

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      const result = AgentRegistrationFileSchema.safeParse(json);
      expect(result.success).toBe(true);
    });

    test("response with A2A only validates against schema", async () => {
      const app = createApp({}, { mcp: false, a2a: ["/agent"] });

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      const result = AgentRegistrationFileSchema.safeParse(json);
      expect(result.success).toBe(true);
    });

    test("response with multiple A2A endpoints validates against schema", async () => {
      const app = createApp(
        {},
        { mcp: true, a2a: ["/.well-known/agent-card.json", "/v2/.well-known/agent-card.json"] },
      );

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      const result = AgentRegistrationFileSchema.safeParse(json);
      expect(result.success).toBe(true);
      expect(json.services).toHaveLength(3); // 2 A2A + 1 MCP
    });

    test("type field is the ERC-8004 registration literal", async () => {
      const app = createApp({});

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      expect(json.type).toBe(ERC8004_REGISTRATION_TYPE);
    });

    test("each service validates against ServiceSchema", async () => {
      const app = createApp({}, { mcp: true, a2a: ["/.well-known/agent-card.json"] });

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      for (const service of json.services) {
        const result = ServiceSchema.safeParse(service);
        expect(result.success).toBe(true);
      }
    });

    test("service endpoints are valid URLs", async () => {
      const app = createApp({}, { mcp: true, a2a: ["/.well-known/agent-card.json"] });

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

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
      const app = createApp({ name: "My Agent", description: "Does things" });

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      expect(json.name).toBe("My Agent");
      expect(json.description).toBe("Does things");
      expect(json.active).toBe(true);
      expect(json.x402support).toBe(true);
      expect(json.image).toBe("http://localhost:3000/icon.png");
    });

    test("A2A service has correct fields", async () => {
      const app = createApp({}, { mcp: false, a2a: ["/.well-known/agent-card.json"] });

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      expect(json.services).toHaveLength(1);
      expect(json.services[0]).toEqual({
        name: "A2A",
        endpoint: "http://localhost:3000/.well-known/agent-card.json",
        version: "0.3.0",
      });
    });

    test("MCP service has correct fields", async () => {
      const app = createApp({}, { mcp: true, a2a: [] });

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      expect(json.services).toHaveLength(1);
      expect(json.services[0]).toEqual({
        name: "MCP",
        endpoint: "http://localhost:3000/mcp",
        version: "2025-06-18",
      });
    });

    test("combined A2A + MCP services in correct order", async () => {
      const app = createApp({}, { mcp: true, a2a: ["/.well-known/agent-card.json"] });

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      expect(json.services).toHaveLength(2);
      expect(json.services[0].name).toBe("A2A");
      expect(json.services[1].name).toBe("MCP");
    });

    test("config defaults applied for empty registration", async () => {
      const app = createApp({});

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      expect(json.name).toBe("Test Agent");
      expect(json.description).toBe("A test agent");
      expect(json.active).toBe(true);
      expect(json.x402support).toBe(true);
      expect(json.image).toBe("http://localhost:3000/icon.png");
    });

    test("user-provided fields override config defaults", async () => {
      const app = createApp({
        name: "Custom Name",
        description: "Custom desc",
        image: "https://example.com/logo.png",
        active: false,
        x402support: false,
      });

      const { json } = await fetchJson(app, "/.well-known/erc-8004.json");

      expect(json.name).toBe("Custom Name");
      expect(json.description).toBe("Custom desc");
      expect(json.image).toBe("https://example.com/logo.png");
      expect(json.active).toBe(false);
      expect(json.x402support).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getAgentRegistrationFile
  // ---------------------------------------------------------------------------

  describe("getAgentRegistrationFile", () => {
    test("returns empty services when mcp: false and a2a: []", () => {
      const file = getAgentRegistrationFile({}, { mcp: false, a2a: [] });
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
        { mcp: true, a2a: [] },
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
    const app = createApp({});

    const res = await app.fetch(
      new Request("http://localhost/.well-known/erc-8004.json", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(404);
  });
});
