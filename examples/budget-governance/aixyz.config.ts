import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Budget Governance Agent",
  description:
    "AI agent with x402 payments AND session-level budget governance via agentpay-mcp. " +
    "Enforces per-session caps, velocity limits, and category policies on top of x402 pricing.",
  version: "0.1.0",
  x402: {
    payTo: process.env.X402_PAY_TO ?? "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.X402_NETWORK ?? (process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532"),
  },
  skills: [
    {
      id: "check-budget",
      name: "Check Budget",
      description: "Check remaining session budget and spending breakdown by category",
      tags: ["budget", "governance", "agentpay"],
      examples: ["How much budget do I have left?", "Show my spending breakdown"],
    },
    {
      id: "request-payment",
      name: "Request Payment",
      description: "Request an x402 payment with budget governance checks (per-call limit, session cap, category cap)",
      tags: ["payment", "x402", "governance", "agentpay"],
      examples: ["Pay $0.50 for data API access", "Execute payment for compute service"],
    },
  ],
};

export default config;
