import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Session Content Agent",
  description:
    "AI agent with x402-authenticated sessions. Each payer gets isolated content storage that persists across requests.",
  version: "0.1.0",
  x402: {
    payTo: "0x0799872E07EA7a63c79357694504FE66EDfE4a0A",
    network: process.env.NODE_ENV === "production" ? "eip155:8453" : "eip155:84532",
  },
  skills: [
    {
      id: "put-content",
      name: "Store Content",
      description: "Store key-value content in your personal session (scoped by x402 signer)",
      tags: ["storage", "session", "x402"],
      examples: ["Store my name as Alice", "Save the API key for later"],
    },
    {
      id: "get-content",
      name: "Retrieve Content",
      description: "Retrieve previously stored content from your personal session",
      tags: ["storage", "session", "x402"],
      examples: ["What is my name?", "Get all my stored content"],
    },
  ],
};

export default config;
