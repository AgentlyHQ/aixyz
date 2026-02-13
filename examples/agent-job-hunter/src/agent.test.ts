import agent from "./agent";
import { expect, test } from "bun:test";
import { writeFile, mkdir } from "node:fs/promises";

async function log(object: any) {
  await mkdir(".aixyz", { recursive: true });
  const content = JSON.stringify(object, (_, v) => (typeof v === "bigint" ? Number(v) : v));
  await writeFile(`.aixyz/${Date.now()}.json`, content);
}

test("should run job hunter agent", async () => {
  const result = await agent.generate({
    prompt: "Find remote jobs in Canada",
  });

  await log(result);
  expect(result.text).toContain("Canada");
}, 180_000);
