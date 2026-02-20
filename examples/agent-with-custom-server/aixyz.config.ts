import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Agent with Custom Server",
  description: "Demonstrates using a custom server.ts to take full control over endpoint registration and pricing.",
  version: "1.0.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: "eip155:8453",
  },
};

export default config;
