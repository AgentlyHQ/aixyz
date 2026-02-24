import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Unit Conversion Agent",
  description: "AI agent that converts temperature values between Celsius, Fahrenheit, and Kelvin.",
  version: "0.1.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
};

export default config;
