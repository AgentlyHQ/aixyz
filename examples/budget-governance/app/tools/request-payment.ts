import { tool } from "ai";
import { z } from "zod";
import { getBudgetState, recordSpend } from "../budget-state";

/**
 * Request an x402 payment with budget governance checks.
 *
 * Enforces three gates before any payment settles:
 *   1. Per-call limit — no single payment exceeds the operator's threshold
 *   2. Session cap — total session spend stays within budget
 *   3. Category cap — spending in each category (data, compute, services)
 *      is independently capped
 *
 * In production, this calls agentpay-mcp's `approve_payment` MCP tool
 * which settles via x402 on Base (USDC).
 *
 * @see https://github.com/up2itnow0822/agentpay-mcp
 */
export default tool({
  description:
    "Request an x402 payment with budget governance. " +
    "Checks per-call limit, session cap, and category cap before approving.",
  parameters: z.object({
    amount: z.string().describe("Payment amount in USD (e.g. '0.25')"),
    category: z
      .enum(["data", "compute", "services"])
      .describe("Spending category for this payment"),
    recipient: z.string().describe("Recipient address or service name"),
    reason: z.string().describe("Why this payment is needed"),
  }),
  execute: async ({ amount, category, recipient, reason }) => {
    const cost = parseFloat(amount);
    const budget = getBudgetState();

    // Gate 1: per-call limit
    if (cost > budget.perCallLimit) {
      budget.blockedCount++;
      return {
        approved: false,
        reason: `Per-call limit exceeded: $${cost} > $${budget.perCallLimit} limit`,
        gate: "per-call",
      };
    }

    // Gate 2: session cap
    if (budget.spent + cost > budget.sessionCap) {
      budget.blockedCount++;
      return {
        approved: false,
        reason: `Session cap exceeded: $${(budget.spent + cost).toFixed(2)} > $${budget.sessionCap} cap`,
        gate: "session",
      };
    }

    // Gate 3: category cap
    const catSpent = budget.categorySpent[category] ?? 0;
    const catCap = budget.categoryCaps[category] ?? budget.sessionCap;
    if (catSpent + cost > catCap) {
      budget.blockedCount++;
      return {
        approved: false,
        reason: `Category '${category}' cap exceeded: $${(catSpent + cost).toFixed(2)} > $${catCap} cap`,
        gate: "category",
      };
    }

    // All gates passed — record the spend
    recordSpend(cost, category);

    return {
      approved: true,
      amount: cost.toFixed(2),
      category,
      recipient,
      reason,
      sessionRemaining: (budget.sessionCap - budget.spent).toFixed(2),
      receipt: `x402-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  },
});
