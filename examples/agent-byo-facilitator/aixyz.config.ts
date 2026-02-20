import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "BYO Facilitator Agent",
  description: "Demonstrates providing a custom x402 facilitator via app/accepts.ts.",
  version: "0.1.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: "eip155:84532",
  },
};

export default config;
