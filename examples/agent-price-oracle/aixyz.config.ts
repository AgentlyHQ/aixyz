import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Price Gecky - Price Oracle Agent",
  description:
    "An AI agent that provides real-time cryptocurrency market data using CoinGecko Pro. Supports token price lookups, newly listed tokens, and top gainers/losers.",
  version: "1.0.0",
  network: "eip155:84532",
  x402: {
    payTo: process.env.X402_PAY_TO!,
    network: process.env.X402_NETWORK!,
  },
  skills: [
    {
      id: "token-price",
      name: "Token Price Lookup",
      description: "Get the current price for any cryptocurrency token",
      tags: ["price", "cryptocurrency", "coingecko", "market"],
      examples: ["What is the price of Bitcoin?", "Get ETH price in USD", "How much is Solana worth?"],
    },
    {
      id: "new-tokens",
      name: "Newly Listed Tokens",
      description: "Discover recently listed tokens on CoinGecko",
      tags: ["new", "tokens", "listing", "discovery"],
      examples: ["Show me new tokens", "What tokens were recently listed?"],
    },
    {
      id: "gainers-losers",
      name: "Top Gainers & Losers",
      description: "Get the top gaining and losing tokens in the last 24 hours",
      tags: ["gainers", "losers", "trending", "24h"],
      examples: ["What are the top gainers today?", "Show me the biggest losers", "Which tokens are pumping?"],
    },
  ],
};

export default config;
