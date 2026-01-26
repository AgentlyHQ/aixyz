import agent from "./agent";
import { expect, test } from "bun:test";
import { writeFile, mkdir } from "node:fs/promises";

async function log(object: any) {
  await mkdir(".agently", { recursive: true });
  const content = JSON.stringify(object, (_, v) => (typeof v === "bigint" ? Number(v) : v));
  await writeFile(`.agently/${Date.now()}.json`, content);
}

test("should run price oracle agent", async () => {
  const result = await agent.generate({
    prompt: "What is the current price of Bitcoin?",
  });

  await log(result);
  expect(result.text).toContain("Bitcoin");
  expect(result.text).toContain("$");
}, 180_000);
