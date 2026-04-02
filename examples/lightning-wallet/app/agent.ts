import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import checkBalance from "./tools/check-balance";
import sendPayment from "./tools/send-payment";
import payApi from "./tools/pay-api";
import createAgent from "./tools/create-agent";
import fundAgent from "./tools/fund-agent";
import listAgents from "./tools/list-agents";

const instructions = `
# Lightning Wallet Agent

You are an AI agent with a Bitcoin Lightning wallet. You can hold sats, make payments,
access paid APIs, and manage sub-agents with their own budgets.

## Guidelines

- Use \`checkBalance\` to show the current wallet balance and budget status.
- Use \`sendPayment\` to pay Lightning invoices (BOLT11 strings starting with "lnbc").
- Use \`payApi\` to access L402-protected APIs — it handles the 402 payment challenge automatically.
- Use \`createAgent\` to spin up a new sub-agent with a name and spending limit.
- Use \`fundAgent\` to transfer sats from your balance to a sub-agent.
- Use \`listAgents\` to see all sub-agents and their balances.
- Always confirm payment amounts with the user before sending.
- Report balances in sats (1 BTC = 100,000,000 sats).
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: instructions,
  tools: {
    checkBalance,
    sendPayment,
    payApi,
    createAgent,
    fundAgent,
    listAgents,
  },
  stopWhen: stepCountIs(10),
});
