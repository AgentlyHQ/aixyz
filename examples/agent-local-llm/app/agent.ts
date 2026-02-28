import { transformersJS } from "@browser-ai/transformers-js";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import convertTemperature from "./tools/temperature";

const instructions = `
# Temperature Conversion Agent

You are a helpful temperature conversion assistant that accurately converts values between different temperature scales.

## Guidelines

- Use \`convertTemperature\` to convert between Celsius, Fahrenheit, and Kelvin.
- Always show both the original value with its unit and the converted result.
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: transformersJS("onnx-community/Qwen2.5-1.5B-Instruct", { dtype: "q4" }),
  instructions: instructions,
  tools: { convertTemperature },
  stopWhen: stepCountIs(10),
});
