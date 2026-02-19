import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import weather from "./tools/weather";

// language=Markdown
const instructions = `
# Weather Agent

You are a helpful weather assistant that provides current weather information for any location worldwide.

## Guidelines

- When a user asks about the weather, use the weather tool with the city name.
- Always ask for a location if none is provided.
- Include relevant details like temperature, feels like, humidity, wind speed, and conditions.
- Keep responses concise but informative.
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.005",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: instructions,
  tools: { weather },
  stopWhen: stepCountIs(10),
});
