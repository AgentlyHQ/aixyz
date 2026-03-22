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
    skills: [
      {
        id: "search",
        name: "Search",
        description: "Search the web",
        tags: ["search"],
      },
    ],
  }),
  getAixyzConfigRuntime: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    skills: [
      {
        id: "search",
        name: "Search",
        description: "Search the web",
        tags: ["search"],
      },
    ],
  }),
}));

import { AixyzApp } from "../index";
import { MetadataPlugin } from "./metadata";

async function fetchJson(app: AixyzApp, path: string) {
  const res = await app.fetch(new Request(`http://localhost${path}`));
  return { res, json: await res.json() };
}

describe("MetadataPlugin", () => {
  test("registers GET /_aixyz/metadata.json route", async () => {
    const app = new AixyzApp();
    await app.withPlugin(new MetadataPlugin());

    expect(app.routes.has("GET /_aixyz/metadata.json")).toBe(true);
  });

  test("returns correct metadata fields", async () => {
    const app = new AixyzApp();
    await app.withPlugin(new MetadataPlugin());

    const { res, json } = await fetchJson(app, "/_aixyz/metadata.json");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(json).toEqual({
      name: "Test Agent",
      description: "A test agent",
      version: "1.0.0",
      skills: [
        {
          id: "search",
          name: "Search",
          description: "Search the web",
          tags: ["search"],
        },
      ],
    });
  });

  test("POST to metadata.json returns 404", async () => {
    const app = new AixyzApp();
    await app.withPlugin(new MetadataPlugin());

    const res = await app.fetch(new Request("http://localhost/_aixyz/metadata.json", { method: "POST", body: "{}" }));
    expect(res.status).toBe(404);
  });
});
