import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

// Require x402 payment per A2A request.
// Remove this export (or set scheme: "free") to make the agent free.
export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: "You are a helpful assistant.",
  // Add tool imports here and list them in the tools object.
  tools: {},
  stopWhen: stepCountIs(10),
});
