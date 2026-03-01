import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Fake Model Agent",
  description: "Demonstrates deterministic agent testing using the aixyz fake model — no API key required.",
  version: "0.1.0",
  x402: {
    payTo: process.env.X402_PAY_TO!,
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
};

export default config;
