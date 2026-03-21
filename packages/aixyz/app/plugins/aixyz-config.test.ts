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
    skills: [
      {
        id: "test-skill",
        name: "Test Skill",
        description: "A test skill",
        tags: ["test"],
        examples: ["Do something"],
      },
    ],
  }),
}));

import { AixyzApp } from "../index";
import { AixyzConfigPlugin } from "./aixyz-config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson(app: AixyzApp, path: string) {
  const res = await app.fetch(new Request(`http://localhost${path}`));
  return { res, json: await res.json() };
}

function createApp() {
  const app = new AixyzApp();
  app.withPlugin(new AixyzConfigPlugin());
  return app;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

describe("AixyzConfigPlugin", () => {
  test("registers GET /.well-known/aixyz.json route", async () => {
    const app = createApp();
    expect(app.routes.has("GET /.well-known/aixyz.json")).toBe(true);
  });

  test("returns 200 with JSON content-type", async () => {
    const app = createApp();
    const { res } = await fetchJson(app, "/.well-known/aixyz.json");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  // ---------------------------------------------------------------------------
  // Response body
  // ---------------------------------------------------------------------------

  describe("response body", () => {
    test("contains name, description, version, and skills", async () => {
      const app = createApp();
      const { json } = await fetchJson(app, "/.well-known/aixyz.json");

      expect(json.name).toBe("Test Agent");
      expect(json.description).toBe("A test agent");
      expect(json.version).toBe("1.0.0");
      expect(json.skills).toEqual([
        {
          id: "test-skill",
          name: "Test Skill",
          description: "A test skill",
          tags: ["test"],
          examples: ["Do something"],
        },
      ]);
    });

    test("only exposes limited fields", async () => {
      const app = createApp();
      const { json } = await fetchJson(app, "/.well-known/aixyz.json");

      expect(Object.keys(json).sort()).toEqual(["description", "name", "skills", "version"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Unregistered routes
  // ---------------------------------------------------------------------------

  test("POST to well-known returns 404", async () => {
    const app = createApp();
    const res = await app.fetch(
      new Request("http://localhost/.well-known/aixyz.json", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(404);
  });
});
