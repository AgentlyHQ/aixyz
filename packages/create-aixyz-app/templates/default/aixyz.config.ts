import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "{{PROJECT_NAME_TITLE}}",
  description: "AI agent created with create-aixyz-app.",
  version: "0.0.0",
  network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  // You can use `process.env.YOUR_PAY_TO_ADDRESS` to conditionally set values based on the environment,
  // For example, .env, .env.local, .env.production, .env.development are supported
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
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
