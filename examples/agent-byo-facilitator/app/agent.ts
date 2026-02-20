import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import weather from "./tools/weather";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.005",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  tools: { weather },
  stopWhen: stepCountIs(10),
});
