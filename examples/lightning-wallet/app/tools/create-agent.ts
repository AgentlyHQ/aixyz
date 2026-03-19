import { tool } from "ai";
import { z } from "zod";
import { lw } from "./lw";

export default tool({
  description: "Create a new sub-agent with its own wallet and an optional daily spending limit.",
  inputSchema: z.object({
    name: z.string().describe("Display name for the sub-agent"),
    budget: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Daily spending limit in sats (optional)"),
  }),
  execute: async ({ name, budget }) => {
    const args = ["create-agent", name];
    if (budget) args.push("--budget", budget.toString());
    return await lw(args);
  },
});
