import { describe, expect, mock, test } from "bun:test";

mock.module("@aixyz/config", () => ({
  getAixyzConfig: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    x402: { payTo: "0x0000000000000000000000000000000000000000", network: "eip155:8453" },
    build: { tools: [], agents: [], excludes: [], poweredByHeader: false },
    vercel: { maxDuration: 30 },
    skills: [],
  }),
}));

import { AixyzApp } from "./index";

describe("AixyzApp poweredByHeader: false", () => {
  test("fetch() does not set X-Powered-By header when disabled", async () => {
    const app = new AixyzApp();
    app.route("GET", "/hello", () => new Response("world"));

    const res = await app.fetch(new Request("http://localhost/hello"));
    expect(res.headers.get("X-Powered-By")).toBeNull();
  });

  test("fetch() does not set X-Powered-By header on 404 when disabled", async () => {
    const app = new AixyzApp();
    const res = await app.fetch(new Request("http://localhost/missing"));
    expect(res.status).toBe(404);
    expect(res.headers.get("X-Powered-By")).toBeNull();
  });
});
