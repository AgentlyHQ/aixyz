import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import convertTemperature from "./tools/temperature";

const instructions = `
# Unit Conversion Agent

You are a helpful unit conversion assistant that accurately converts temperature values between different measurement systems.

## Guidelines

- Use \`convertTemperature\` for temperature conversions (Celsius, Fahrenheit, Kelvin).
- Always show both the original value with its unit and the converted result.
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: instructions,
  tools: { convertTemperature },
  stopWhen: stepCountIs(10),
});
