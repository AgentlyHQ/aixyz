import { tool } from "ai";
import { z } from "zod";
import { lw } from "./lw";

export default tool({
  description: "List all sub-agents with their balances, budgets, and status.",
  inputSchema: z.object({}),
  execute: async () => {
    return await lw(["list-agents"]);
  },
});
