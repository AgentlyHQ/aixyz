import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Agent with Express",
  description: "Demonstrates mounting an AixyzApp on an Express server using the toExpress adapter.",
  version: "1.0.0",
  x402: {
    payTo: process.env.X402_PAY_TO ?? "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.X402_NETWORK ?? "eip155:8453",
  },
};

export default config;
