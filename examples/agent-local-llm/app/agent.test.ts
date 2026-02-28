import { expect, test } from "bun:test";

import agent from "./agent";

test(
  "agent can convert temperature",
  async () => {
    const result = await agent.generate({
      prompt: "convert 100 degrees celsius to fahrenheit",
    });
    expect(result.text).toContain("212");
  },
  { timeout: 300_000 },
);
