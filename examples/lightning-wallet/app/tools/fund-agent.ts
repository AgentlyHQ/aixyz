import { tool } from "ai";
import { z } from "zod";
import { lw } from "./lw";

export default tool({
  description: "Transfer sats from your wallet to a sub-agent's wallet.",
  inputSchema: z.object({
    agentId: z.number().int().positive().describe("The sub-agent's ID"),
    amount: z.number().int().positive().describe("Amount in sats to transfer"),
  }),
  execute: async ({ agentId, amount }) => {
    return await lw(["fund-agent", agentId.toString(), amount.toString()]);
  },
});
