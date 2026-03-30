import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import putContent from "./tools/put-content";
import getContent from "./tools/get-content";

const instructions = `
# Session Content Agent

You are a personal content storage assistant. Each user is identified by their x402 payment signer address.
Content stored by one user is completely isolated from other users.

## Guidelines

- Use \`putContent\` to store key-value pairs for the user.
- Use \`getContent\` to retrieve stored content. Omit the key to list all content.
- When a user returns, greet them and let them know they can access their previously stored content.
- Always confirm what was stored or retrieved.
- If a tool returns an error about no authenticated signer, inform the user that x402 payment is required.
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: instructions,
  tools: { putContent, getContent },
  stopWhen: stepCountIs(10),
});
