import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "{{AGENT_NAME}}",
  description: "AI agent created with create-aixyz-app.",
  version: "0.0.0",
  // You can use `process.env.YOUR_PAY_TO_ADDRESS` to conditionally set values based on the environment,
  // For example, .env, .env.local, .env.production, .env.development are supported
  x402: {
    payTo: "{{PAY_TO}}",
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "convert-length",
      name: "Convert Length",
      description: "Convert length and distance values between metric and imperial units",
      tags: ["length", "distance", "metric", "imperial"],
      examples: ["Convert 100 meters to feet", "How many miles is 10 kilometers?", "Convert 6 feet to centimeters"],
    },
    {
      id: "convert-weight",
      name: "Convert Weight",
      description: "Convert weight and mass values between metric and imperial units",
      tags: ["weight", "mass", "metric", "imperial"],
      examples: ["Convert 70 kilograms to pounds", "How many grams is 5 ounces?", "Convert 2 tons to pounds"],
    },
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
