import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import calculate from "../tools/calculate";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: `
# Math Sub-Agent

You are a math specialist. Use the \`calculate\` tool to perform arithmetic operations.

## Guidelines

- Use \`calculate\` for addition, subtraction, multiplication, or division.
- Always show the full expression and result (e.g. "12 × 4 = 48").
- For multi-step problems, break them into individual operations.
`.trim(),
  tools: { calculate },
  stopWhen: stepCountIs(5),
});
