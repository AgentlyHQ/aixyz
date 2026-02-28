import { beforeAll, expect, test } from "bun:test";
import { AutoModelForCausalLM, AutoTokenizer } from "@huggingface/transformers";

import agent from "./agent";

beforeAll(
  async () => {
    await Promise.all([
      AutoTokenizer.from_pretrained("onnx-community/Qwen2.5-1.5B-Instruct"),
      AutoModelForCausalLM.from_pretrained("onnx-community/Qwen2.5-1.5B-Instruct", { dtype: "q4" }),
    ]);
  },
  { timeout: 300_000 },
);

test(
  "agent can convert temperature",
  async () => {
    const result = await agent.generate({
      prompt: "convert 100 degrees celsius to fahrenheit",
    });
    expect(result.text).toContain("212");
  },
  { timeout: 60_000 },
);
