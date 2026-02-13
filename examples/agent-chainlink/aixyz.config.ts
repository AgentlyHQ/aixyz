import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Chainlink Price Oracle",
  description:
    "AI agent that provides real-time cryptocurrency price data using Chainlink price feeds on Ethereum mainnet.",
  version: "1.0.0",
  network: "eip155:1",
  x402: {
    payTo: process.env.X402_PAY_TO!,
    network: process.env.X402_NETWORK!,
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
