import agent from "./agent";
import { expect, test } from "bun:test";
import { writeFile, mkdir } from "node:fs/promises";

async function log(object: any) {
  await mkdir(".agently", { recursive: true });
  const content = JSON.stringify(object, (_, v) => (typeof v === "bigint" ? Number(v) : v));
  await writeFile(`.agently/${Date.now()}.json`, content);
}

test("should search for flights from Sao Paulo", async () => {
  const result = await agent.generate({
    prompt:
      "Find me the cheapest flights from Sao Paulo (GRU) to anywhere in Europe. I want a trip of at least 7 days.",
  });

  await log(result);
  expect(result.text).toBeDefined();
  // The response should mention some flight details
  expect(result.text.toLowerCase()).toMatch(/flight|price|destination|\$/i);
}, 180_000);
