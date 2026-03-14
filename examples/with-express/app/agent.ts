import { fake } from "aixyz/model";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import convertTemperature from "./tools/temperature";

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: fake((lastMessage) => {
    return `You asked about: "${lastMessage}". I can help convert temperatures between Celsius, Fahrenheit, and Kelvin.`;
  }),
  instructions: "You are a helpful temperature conversion assistant.",
  tools: { convertTemperature },
  stopWhen: stepCountIs(10),
});
