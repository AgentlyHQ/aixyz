import { describe, expect, mock, test } from "bun:test";

mock.module("@aixyz/config", () => ({
  getAixyzConfigRuntime: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    skills: [
      {
        id: "skill-travel",
        name: "Travel Planner",
        description: "Plans trips and itineraries",
        tags: ["travel", "planning"],
        examples: ["Plan a trip to Paris", "Find flights to Tokyo"],
      },
    ],
  }),
}));

import { AixyzApp } from "../index";
import { IndexPagePlugin } from "./index-page";

describe("IndexPagePlugin", () => {
  test("registers GET / that returns text/plain with agent info", async () => {
    const app = new AixyzApp();
    await app.withPlugin(new IndexPagePlugin());

    const res = await app.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");

    const text = await res.text();
    expect(text).toContain("Test Agent");
    expect(text).toContain("A test agent");
    expect(text).toContain("1.0.0");
  });

  test("supports custom path", async () => {
    const app = new AixyzApp();
    await app.withPlugin(new IndexPagePlugin("/info"));

    expect(app.routes.has("GET /info")).toBe(true);
    expect(app.routes.has("GET /")).toBe(false);
  });

  test("exact response body format", async () => {
    const app = new AixyzApp();
    await app.withPlugin(new IndexPagePlugin());

    const res = await app.fetch(new Request("http://localhost/"));
    const text = await res.text();

    const expected = [
      "Test Agent",
      "==========",
      "",
      "Description: A test agent",
      "Version: 1.0.0",
      "",
      "Skills:",
      "",
      "1. Travel Planner",
      "   ID: skill-travel",
      "   Description: Plans trips and itineraries",
      "   Tags: travel, planning",
      "   Examples:",
      "   - Plan a trip to Paris",
      "   - Find flights to Tokyo",
      "",
    ].join("\n");

    expect(text).toBe(expected);
  });

  test("skills rendering with tags and examples", async () => {
    const app = new AixyzApp();
    await app.withPlugin(new IndexPagePlugin());

    const res = await app.fetch(new Request("http://localhost/"));
    const text = await res.text();

    expect(text).toContain("Skills:");
    expect(text).toContain("1. Travel Planner");
    expect(text).toContain("   ID: skill-travel");
    expect(text).toContain("   Tags: travel, planning");
    expect(text).toContain("   Examples:");
    expect(text).toContain("   - Plan a trip to Paris");
    expect(text).toContain("   - Find flights to Tokyo");
  });

  test("invalid path throws", () => {
    expect(() => {
      const app = new AixyzApp();
      const plugin = new IndexPagePlugin("no-slash");
      plugin.register(app);
    }).toThrow('Invalid path: no-slash. Path must start with "/"');
  });
});
