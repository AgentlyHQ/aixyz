import { tool } from "ai";
import { z } from "zod";
import { getBudgetState } from "../budget-state";

/**
 * Check remaining session budget and spending breakdown.
 *
 * In production, this calls agentpay-mcp's `get_spending_report` MCP tool.
 * This example uses an in-memory budget state for demonstration.
 *
 * @see https://github.com/up2itnow0822/agentpay-mcp
 */
export default tool({
  description: "Check remaining session budget and spending breakdown by category",
  parameters: z.object({}),
  execute: async () => {
    const budget = getBudgetState();
    const remaining = budget.sessionCap - budget.spent;

    return {
      sessionCap: budget.sessionCap.toString(),
      spent: budget.spent.toString(),
      remaining: remaining.toString(),
      perCallLimit: budget.perCallLimit.toString(),
      callsMade: budget.callCount,
      callsBlocked: budget.blockedCount,
      byCategory: Object.fromEntries(
        Object.entries(budget.categorySpent).map(([k, v]) => [
          k,
          {
            spent: v.toString(),
            cap: (budget.categoryCaps[k] ?? budget.sessionCap).toString(),
            remaining: ((budget.categoryCaps[k] ?? budget.sessionCap) - v).toString(),
          },
        ])
      ),
    };
  },
});
