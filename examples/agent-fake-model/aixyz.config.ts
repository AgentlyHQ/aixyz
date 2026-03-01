import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Fake Model Agent",
  description: "Demonstrates deterministic agent testing using the aixyz fake model — no API key required.",
  version: "0.1.0",
  x402: {
    payTo: "0x0000000000000000000000000000000000000000",
    network: "eip155:84532",
  },
};

export default config;
