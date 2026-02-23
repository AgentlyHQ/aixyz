import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "My Agent",
  description: "A short description of what this agent does.",
  version: "0.1.0",
  x402: {
    // Wallet address that receives x402 micropayments.
    // Set via X402_PAY_TO env var or hard-code here.
    payTo: process.env.X402_PAY_TO!,
    // Base mainnet in production, Base Sepolia testnet in development.
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "my-skill",
      name: "My Skill",
      description: "A one-line description of what this skill does.",
      tags: ["example"],
      examples: ["Example prompt that exercises this skill"],
    },
  ],
};

export default config;
