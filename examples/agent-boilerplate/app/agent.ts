import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import convertLength from "./tools/length";
import convertTemperature from "./tools/temperature";
import convertWeight from "./tools/weight";

const instructions = `
# Unit Conversion Agent

You are a helpful unit conversion assistant that accurately converts values between different measurement systems.

## Guidelines

- Use the appropriate tool based on the type of conversion requested.
- Use \`convertLength\` for distances and lengths (meters, feet, miles, km, etc.).
- Use \`convertWeight\` for mass and weight (kilograms, pounds, ounces, etc.).
- Use \`convertTemperature\` for temperature (Celsius, Fahrenheit, Kelvin).
- Always show both the original value with its unit and the converted result.
- If the unit type is ambiguous, ask the user to clarify.
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: instructions,
  tools: { convertLength, convertWeight, convertTemperature },
  stopWhen: stepCountIs(10),
});
