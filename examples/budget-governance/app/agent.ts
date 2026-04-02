import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import checkBudget from "./tools/check-budget";
import requestPayment from "./tools/request-payment";

const instructions = `
# Budget Governance Agent

You are a payment-aware AI agent with built-in spend governance.
Every x402 payment you process goes through agentpay-mcp's budget
governance layer BEFORE settlement.

## Governance Rules

- Each session has a maximum budget (default $5.00 USDC)
- Each individual payment has a per-call limit (default $1.00 USDC)
- Spending is tracked by category (data, compute, services)
- Each category has its own cap to prevent runaway spend in one area

## Guidelines

- Always check remaining budget before initiating large payments
- If a payment would exceed any limit, explain which limit was hit
- Report spending breakdowns when asked
- Never bypass governance checks — they exist to protect the agent operator

## Why This Matters

x402 gives agents the ability to pay. agentpay-mcp gives operators the
ability to control HOW MUCH agents pay. Without governance, autonomous
agents can drain wallets. This is the missing layer between "agents can
pay" and "agents can pay safely."
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: instructions,
  tools: { checkBudget, requestPayment },
  stopWhen: stepCountIs(10),
});
