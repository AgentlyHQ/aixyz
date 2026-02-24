import { describe, expect, test, beforeAll } from "bun:test";
import { ToolLoopAgent } from "ai";
import { loadEnv } from "aixyz/test";
import agent, { accepts } from "./agent";

test("default export is a ToolLoopAgent", () => {
  expect(agent).toBeInstanceOf(ToolLoopAgent);
});

test("has convertTemperature tool registered", () => {
  expect(agent.tools).toHaveProperty("convertTemperature");
});

test("accepts config uses exact scheme", () => {
  expect(accepts.scheme).toBe("exact");
});

describe("non deterministic agent test", () => {
  // Loads .env.test.local (where OPENAI_API_KEY lives), .env.local is ignored.
  loadEnv();

  test.skipIf(!process.env.OPENAI_API_KEY)("agent can convert temperature", async () => {
    const result = await agent.generate({
      prompt: "convert 100 degrees celsius to fahrenheit",
    });
    expect(result.text).toContain("212");
  });
});
