import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Weather Agent",
  description: "AI agent that provides current weather information for any location worldwide.",
  version: "0.1.0",
  network: "eip155:84532",
  // You can use `process.env.YOUR_ENV_KEY` to conditionally set values based on the environment
  // .env, .env.local, .env.production, .env.development are supported
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
