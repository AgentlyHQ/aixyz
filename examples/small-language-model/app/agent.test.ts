import { beforeAll, expect, test } from "vitest";
import { AutoModelForCausalLM, AutoTokenizer } from "@huggingface/transformers";

import agent from "./agent";

beforeAll(async () => {
  await Promise.all([
    AutoTokenizer.from_pretrained("HuggingFaceTB/SmolLM2-360M-Instruct"),
    AutoModelForCausalLM.from_pretrained("HuggingFaceTB/SmolLM2-360M-Instruct", { dtype: "fp32" }),
  ]);
}, 300_000);

test("summarises a news-style paragraph", async () => {
  const prompt = `Summarize this: Scientists at MIT have developed a new battery technology that can charge electric vehicles in under 10 minutes. The breakthrough uses a lithium-metal anode combined with a solid electrolyte, which allows for faster ion transfer. Researchers say the technology could be commercially available within five years and would significantly reduce range anxiety for EV owners.`;
  const result = await agent.generate({ prompt });
  console.log("Result:", result.text);
  expect(result.text.length).toBeGreaterThan(0);
  expect(result.text.length).toBeLessThan(prompt.length);
}, 60_000);

test("summarises a product review", async () => {
  const prompt = `Summarize this review: I bought this wireless keyboard last month and I am very happy with it. The keys are quiet and responsive, the battery lasts about two weeks on a single charge, and it connects to my laptop instantly via Bluetooth. The only downside is that the wrist rest could be more comfortable for long typing sessions. Overall I would recommend it to anyone looking for a reliable wireless keyboard.`;
  const result = await agent.generate({ prompt });
  console.log("Result:", result.text);
  expect(result.text.length).toBeGreaterThan(0);
  expect(result.text.length).toBeLessThan(prompt.length);
}, 60_000);

test("summarises a historical event", async () => {
  const prompt = `Summarize this: On July 20, 1969, astronauts Neil Armstrong and Buzz Aldrin landed the Apollo 11 lunar module on the surface of the Moon while Michael Collins orbited above in the command module. Armstrong became the first human to set foot on the Moon, famously saying "That's one small step for man, one giant leap for mankind." The mission returned safely to Earth on July 24 and was watched by an estimated 600 million people worldwide on television.`;
  const result = await agent.generate({ prompt });
  console.log("Result:", result.text);
  expect(result.text.length).toBeGreaterThan(0);
  expect(result.text.length).toBeLessThan(prompt.length);
}, 60_000);
