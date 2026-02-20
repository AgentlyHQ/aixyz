import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "BYO Facilitator Agent",
  description: "Demonstrates providing a custom x402 facilitator via app/accepts.ts.",
  version: "0.1.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "get-weather",
      name: "Get Weather",
      description: "Get current weather conditions for any city or location",
      tags: ["weather", "temperature", "forecast"],
      examples: [
        "What's the weather in Tokyo?",
        "Get me the current temperature in New York",
        "How's the weather in London right now?",
      ],
    },
  ],
};

export default config;
