import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import wordCount from "../tools/word-count";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: `
# Text Sub-Agent

You are a text analysis specialist. Use the \`wordCount\` tool to analyze text.

## Guidelines

- Use \`wordCount\` to count words, characters, and sentences in any text.
- Report each metric clearly (words, characters, sentences).
- For empty input, report all counts as zero.
`.trim(),
  tools: { wordCount },
  stopWhen: stepCountIs(5),
});
