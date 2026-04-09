/**
 * In-memory budget state for the governance example.
 *
 * In production, replace this with agentpay-mcp MCP tool calls:
 *   - check_budget → getBudgetState()
 *   - approve_payment → recordSpend()
 *   - get_spending_report → full audit trail
 *
 * agentpay-mcp persists state across sessions and settles payments
 * on-chain via x402 on Base (USDC).
 *
 * @see https://github.com/up2itnow0822/agentpay-mcp
 */

export interface BudgetState {
  sessionCap: number;
  perCallLimit: number;
  spent: number;
  callCount: number;
  blockedCount: number;
  categoryCaps: Record<string, number>;
  categorySpent: Record<string, number>;
}

const state: BudgetState = {
  sessionCap: 5.0,       // $5.00 USDC per session
  perCallLimit: 1.0,     // $1.00 max per individual payment
  spent: 0,
  callCount: 0,
  blockedCount: 0,
  categoryCaps: {
    data: 3.0,           // $3.00 cap for data APIs
    compute: 2.0,        // $2.00 cap for compute services
    services: 2.0,       // $2.00 cap for general services
  },
  categorySpent: {},
};

export function getBudgetState(): BudgetState {
  return state;
}

export function recordSpend(amount: number, category: string): void {
  state.spent += amount;
  state.callCount++;
  state.categorySpent[category] = (state.categorySpent[category] ?? 0) + amount;
}
