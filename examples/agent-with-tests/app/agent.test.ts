import { describe, expect, test } from "bun:test";
import { ToolLoopAgent } from "ai";
import agent, { accepts } from "./agent";

describe("agent", () => {
  test("default export is a ToolLoopAgent", () => {
    expect(agent).toBeInstanceOf(ToolLoopAgent);
  });

  test("has convertTemperature tool registered", () => {
    expect(agent.tools).toHaveProperty("convertTemperature");
  });

  test("accepts config uses exact scheme", () => {
    expect(accepts.scheme).toBe("exact");
  });

  test("accepts config has a price", () => {
    expect(accepts.price).toBeDefined();
  });
});
