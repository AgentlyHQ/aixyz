import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Unit Conversion Agent",
  description: "AI agent that converts temperature values between Celsius, Fahrenheit, and Kelvin.",
  version: "0.1.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "convert-temperature",
      name: "Convert Temperature",
      description: "Convert temperature values between Celsius, Fahrenheit, and Kelvin",
      tags: ["temperature", "celsius", "fahrenheit", "kelvin"],
      examples: ["Convert 100°C to Fahrenheit", "What is 72°F in Celsius?", "Convert 300 Kelvin to Celsius"],
    },
  ],
};

export default config;
