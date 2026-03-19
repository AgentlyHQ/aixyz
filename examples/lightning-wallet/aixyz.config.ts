import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Lightning Wallet Agent",
  description:
    "AI agent with a Bitcoin Lightning wallet. Can check balances, send payments, pay for L402 APIs, and manage sub-agents with spending limits.",
  version: "0.1.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network:
      process.env.NODE_ENV === "production"
        ? "eip155:8453"
        : "eip155:84532",
  },
  skills: [
    {
      id: "check-balance",
      name: "Check Balance",
      description:
        "Check the agent's Bitcoin Lightning wallet balance and budget status",
      tags: ["bitcoin", "lightning", "balance", "wallet"],
      examples: [
        "What's my balance?",
        "How many sats do I have?",
        "Show my wallet status",
      ],
    },
    {
      id: "send-payment",
      name: "Send Payment",
      description:
        "Pay a Lightning invoice or send sats to another agent",
      tags: ["bitcoin", "lightning", "payment", "send", "invoice"],
      examples: [
        "Pay this invoice: lnbc100n1...",
        "Send 50 sats to agent Research Bot",
        "Pay 100 sats to this Lightning address",
      ],
    },
    {
      id: "pay-api",
      name: "Pay L402 API",
      description:
        "Access a paid API using the L402 protocol — automatically handles authentication and micropayments",
      tags: ["l402", "api", "paid-api", "lightning", "http-402"],
      examples: [
        "Get a fortune from the L402 API",
        "Access the paid weather API",
        "Fetch data from this L402-protected endpoint",
      ],
    },
    {
      id: "manage-agents",
      name: "Manage Sub-Agents",
      description:
        "Create sub-agents with their own wallets and spending limits, fund them, and monitor their activity",
      tags: ["agents", "budget", "spending-limit", "multi-agent"],
      examples: [
        "Create a research agent with a 1000 sat budget",
        "Fund my research agent with 500 sats",
        "List all my sub-agents and their balances",
      ],
    },
  ],
};

export default config;
