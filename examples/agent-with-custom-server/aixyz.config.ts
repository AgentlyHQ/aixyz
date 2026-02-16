import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Chainlink Price Oracle (Custom Server)",
  description:
    "AI agent that provides real-time cryptocurrency price data using Chainlink price feeds. Demonstrates using a custom server.ts to control endpoint registration and pricing.",
  version: "1.0.0",
  network: "eip155:1",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: "eip155:8453",
  },
  skills: [
    {
      id: "chainlink-price-lookup",
      name: "Chainlink Price Lookup",
      description: "Look up real-time cryptocurrency prices in USD using Chainlink price feeds",
      tags: ["crypto", "price", "oracle", "chainlink", "ethereum"],
      examples: ["What is the current price of ETH?", "Look up the price of BTC", "Get me the latest LINK price"],
    },
  ],
};

export default config;
